import { gql } from "urql";
import { Pool } from "../models";
import { CustomError } from "../utils/error_factory";
import { client } from "..";
import { NextFunction, Request, Response } from "express";
import { addPool } from "../functions/pool";

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
          volume
        }
      }
    `;

    //@ts-ignore
    const result = await client.query(pools_query);

    const pools = result.data.Pool;

    const toSend = [];

    for (const pool of pools) {
      let dbPool = await addPool(pool, next);

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

const getPoolSnapshotsById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const timestamp24hAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  try {
    const id = req.params.id;
    console.log(id);

    const pool_query = gql`
        query MyQuery {
  SwapHourly(where: {snapshot_time: {_gt: ${timestamp24hAgo.toString()}}, 
  pool_id: {_eq: ${id}}}) {
    asset_0_in
    asset_0_out
    asset_1_in
    asset_1_out
    count
    feesUSD
    id
    pool_id
    snapshot_time
  }
}
      `;
    //@ts-ignore
    const result = await client.query(pool_query);
    console.log(result.data.SwapHourly);
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

export { getPools, getPoolSnapshotsById };
