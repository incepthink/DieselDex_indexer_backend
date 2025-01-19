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

    // add pools
    for (const pool of pools) {
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
