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
    console.log(pools);

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

    console.log(yesterdayMidnightTimestamp);

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
    console.log(id);

    const fees_query = gql`
        query MyQuery($time: Int!) {
  SwapHourly(where: {snapshot_time: {_gt: $time}, 
  pool_id: {_eq: "${id}"}}) {
    feesUSD
  }
}
      `;

    const result0 = await client.query(fees_query, {
      time: yesterdayMidnightTimestamp,
    });

    const tvl_query = gql`
      query MyQuery {
  Pool(where: {id: {_eq: "${id}"}}) {
    tvlUSD
  }
}
    `;
    //@ts-ignore
    const result1 = await client.query(tvl_query);
    console.log(result1);

    if (result0.data.SwapHourly && result1.data.Pool[0].tvlUSD) {
      const feesArr = result0.data.SwapHourly;
      const tvlUSD = result1.data.Pool[0].tvlUSD;
      console.log(result0.data.SwapHourly, result1.data.Pool);

      const fees24hr = feesArr.reduce((total: number, item: any) => {
        return total + parseFloat(item.feesUSD);
      }, 0);

      // if (tvlUSD && fees24hr) {

      // }

      const apr = ((fees24hr / parseFloat(tvlUSD)) * 365).toFixed(2);

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
