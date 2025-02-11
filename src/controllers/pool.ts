import { gql } from "urql";
import { Pool } from "../models";
import { CustomError } from "../utils/error_factory";
import { client } from "..";
import { NextFunction, Request, Response } from "express";
import {
  addPool,
  aggregatePoolFeesAndVolume,
  populatePool,
  SwapDaily,
} from "../functions/pool";
import BN from "bn.js";
import axios from "axios";

const USDC_ID =
  "0x286c479da40dc953bddc3bb4c453b608bba2e0ac483b077bd475174115395e6b";
let ETH_ID =
  "0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07";
let FUEL_ID =
  "0x1d5d97005e41cae2187a895fd8eab0506111e0e2f3331cd3912c15c24e3c1d82";

const getPoolsBylpId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    console.log(req.body.ids);

    const lpIds = req.body.ids;
    console.log(lpIds);

    const toSend = [];
    for (const lpId of lpIds) {
      const pool = await Pool.findOne({
        where: {
          lpId: lpId,
        },
      });
      toSend.push(pool);
    }

    res.status(200).json({
      pools: toSend,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get pools by lp";

    return next(
      new CustomError(message, statusCode, { context: "getPoolsBylpId", error })
    );
  }
};

const getPoolsDb = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const pools = await Pool.findAll();
    console.log(pools);

    const toSend = [];
    for (const pool of pools) {
      let dbPool = await populatePool(pool, true, next);

      toSend.push(dbPool);
    }

    console.log(toSend);

    res.status(200).json({
      success: toSend,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get pools";

    return next(
      new CustomError(message, statusCode, { context: "getPools", error })
    );
  }
};

function toDecimal(bnValue: BN, decimals: number) {
  const divisor = new BN(10).pow(new BN(decimals));
  const integerPart = bnValue.div(divisor).toString(); // Integer part
  const fractionalPart = bnValue
    .mod(divisor)
    .toString()
    .padStart(decimals, "0"); // Fractional part
  return `${integerPart}.${fractionalPart}`.replace(/\.?0+$/, ""); // Trim trailing zeroes
}

function calculatePoolTVL(
  pool: Pool,
  reserve0: bigint,
  reserve1: bigint,
  ETH_PRICE_USD: any,
  USDC_PRICE_USD: any,
  FUEL_PRICE_USD: any
): number {
  const tvl = reserve0 + reserve1;

  // For ETH pairs
  if (pool.asset_0 === ETH_ID || pool.asset_1 === ETH_ID) {
    if (pool.asset_0 === ETH_ID) {
      // ETH is token0
      // const ethAmt = Number(toDecimal(new BN(pool.reserve_0.toString()), pool.decimals_0))
      const ethAmt = (Number(reserve0) / 10 ** pool.decimals_0) * ETH_PRICE_USD;

      const tvlUSD = ethAmt * 2;

      return tvlUSD;
    } else {
      // ETH is token1
      //const ethAmt = Number(toDecimal(new BN(pool.reserve_1.toString()), pool.decimals_1))
      const ethAmt = (Number(reserve1) / 10 ** pool.decimals_1) * ETH_PRICE_USD;
      const tvlUSD = ethAmt * 2;

      return tvlUSD;
    }
  }

  // For USDC pairs
  if (pool.asset_0 === USDC_ID || pool.asset_1 === USDC_ID) {
    if (pool.asset_0 === USDC_ID) {
      // USDC is token0
      const usdcAmt = Number(
        toDecimal(new BN(reserve0.toString()), pool.decimals_0)
      );
      const tvlUSD = usdcAmt * 2 * USDC_PRICE_USD;

      return tvlUSD;
    } else {
      // USDC is token1
      const usdcAmt = Number(
        toDecimal(new BN(reserve1.toString()), pool.decimals_1)
      );
      const tvlUSD = usdcAmt * 2 * USDC_PRICE_USD;

      return tvlUSD;
    }
  }

  // For Fuel Pairs
  if (pool.asset_0 === FUEL_ID || pool.asset_1 === FUEL_ID) {
    // Continue here
    if (pool.asset_0 === FUEL_ID) {
      // FUEL is token0
      const fuelAmt = Number(
        toDecimal(new BN(reserve0.toString()), pool.decimals_0)
      );
      const tvlUSD = fuelAmt * 2 * FUEL_PRICE_USD;

      return tvlUSD;
    } else {
      // FUEL is token1
      const fuelAmt = Number(
        toDecimal(new BN(reserve1.toString()), pool.decimals_1)
      );
      const tvlUSD = fuelAmt * 2 * FUEL_PRICE_USD;

      return tvlUSD;
    }
  }

  return 0;
}

const getPools = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const pools_query = gql`
      query MyQuery {
        Pool(limit: 100, order_by: { tvlUSD: desc }) {
          asset_0
          asset_1
          id
          create_time
          decimals_0
          decimals_1
          reserve_0
          reserve_1
          is_stable
          tvl
          tvlUSD
          lpId
          swapVolume
        }
      }
    `;

    //@ts-ignore
    const result = await client.query(pools_query);

    const pools = result.data.Pool;

    const url =
      "https://coins.llama.fi/prices/current/fuel:0x286c479da40dc953bddc3bb4c453b608bba2e0ac483b077bd475174115395e6b,fuel:0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07,fuel:0x1d5d97005e41cae2187a895fd8eab0506111e0e2f3331cd3912c15c24e3c1d82";

    const resultAxios = await axios.get(url);

    let USDC_PRICE_USD =
      resultAxios.data.coins[
        "fuel:0x286c479da40dc953bddc3bb4c453b608bba2e0ac483b077bd475174115395e6b"
      ].price;

    let ETH_PRICE_USD =
      resultAxios.data.coins[
        "fuel:0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07"
      ].price;

    let FUEL_PRICE_USD =
      resultAxios.data.coins[
        "fuel:0x1d5d97005e41cae2187a895fd8eab0506111e0e2f3331cd3912c15c24e3c1d82"
      ].price;

    // add pools
    for (const pool of pools) {
      pool.tvlUSD = calculatePoolTVL(
        pool,
        pool.reserve_0,
        pool.reserve_1,
        ETH_PRICE_USD,
        USDC_PRICE_USD,
        FUEL_PRICE_USD
      );

      let dbPool = await addPool(pool, next);
    }

    // Update fees and volume
    const yesterdayMidnightTimestamp = Math.floor(
      new Date(new Date().setDate(new Date().getDate() - 1)).setHours(
        0,
        0,
        0,
        0
      ) / 1000
    );

    const feesQuery = gql`
      query MyQuery($time: Int!) {
        SwapHourly(where: { snapshot_time: { _gte: $time } }) {
          pool_id
          feesUSD
          volume
        }
      }
    `;

    const res1 = await client.query(feesQuery, {
      time: yesterdayMidnightTimestamp,
    });

    const snapshots: SwapDaily[] = res1.data.SwapHourly;

    const poolsWithFees = aggregatePoolFeesAndVolume(snapshots);

    const updatedPools: any[] = [];
    for (const pool of poolsWithFees) {
      const updatedPool = await Pool.update(
        {
          fees24hr: pool.fees24hr,
          volume24hr: pool.volume24hr,
        },
        {
          where: {
            pool_id: pool.pool_id,
          },
        }
      );
    }

    // Populate with assets

    const toSend = [];
    for (const pool of pools) {
      let dbPool = await populatePool(pool, false, next);

      toSend.push(dbPool);
    }

    return res.status(200).json({ success: toSend });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get pools";

    return next(
      new CustomError(message, statusCode, { context: "getPools", error })
    );
  }
};

const getPoolAprById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const yesterdayMidnightTimestamp = Math.floor(
    new Date(new Date().setDate(new Date().getDate() - 1)).setHours(
      0,
      0,
      0,
      0
    ) / 1000
  );
  // CHANGE STRUCTURE OF ID
  try {
    const id = req.params.id;

    const pool = await Pool.findByPk(id);

    if (pool) {
      const feeRate = pool.is_stable ? 0.05 : 0.3;
      const apr = (pool.volume24hr * feeRate * 365) / pool.tvlUSD;

      return res.status(200).json({
        data: {
          pool: id,
          apr,
        },
      });
    } else {
      return res.status(200).json({
        data: {
          pool: id,
          apr: 0,
        },
      });
    }
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get pool snapshot";
    console.error(error);
    return next(
      new CustomError(message, statusCode, {
        context: "getSnapshotsByID",
        error,
      })
    );
  }
};

const updatePoolsFees = async (
  req: Request,
  res: Response,
  next: NextFunction,
  pools: Pool
): Promise<any> => {
  try {
    const pools = await Pool.findAll({
      order: [["tvlUSD", "DESC"]],
      limit: 25,
    });

    const yesterdayMidnightTimestamp = Math.floor(
      new Date(new Date().setDate(new Date().getDate() - 1)).setHours(
        0,
        0,
        0,
        0
      ) / 1000
    );

    const feesQuery = gql`
      query MyQuery($time: Int!) {
        SwapDaily(
          where: { snapshot_time: { _gte: $time }, feesUSD: { _gt: 0 } }
        ) {
          pool_id
          feesUSD
          volume
        }
      }
    `;

    const result = await client.query(feesQuery, {
      time: yesterdayMidnightTimestamp,
    });

    const snapshots: SwapDaily[] = result.data.SwapDaily;

    const poolsWithFees = aggregatePoolFeesAndVolume(snapshots);

    const updatedPools: any[] = [];
    for (const pool of poolsWithFees) {
      const updatedPool = await Pool.update(
        {
          fees24hr: pool.fees24hr,
          volume24hr: pool.volume24hr,
        },
        {
          where: {
            pool_id: pool.pool_id,
          },
        }
      );

      // TODO Response is not right
      updatedPools.push({
        pool_id: pool.pool_id,
        fees24hr: pool.fees24hr,
        volume24hr: pool.volume24hr,
      });
    }

    return res.json({
      updatedPools,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get pool snapshot";
    console.error(error);
    return next(
      new CustomError(message, statusCode, {
        context: "updatePoolsFees",
        error,
      })
    );
  }
};

export {
  getPools,
  getPoolAprById,
  updatePoolsFees,
  getPoolsBylpId,
  getPoolsDb,
};
