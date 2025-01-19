import { NextFunction, Request, Response } from "express";
import { CustomError } from "../utils/error_factory";
import { Pool } from "../models";
import { gql } from "urql";
import { client } from "..";

const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toFixed(2); // For smaller numbers
};

const getHomeData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const tradersQuery = gql`
      query MyQuery {
        Transaction(
          where: { transaction_type: { _eq: "SWAP" } }
          distinct_on: initiator
        ) {
          id
        }
      }
    `;

    //@ts-ignore
    const result = await client.query(tradersQuery);

    const traders = result.data.Transaction.length;

    const pools = await Pool.findAll();
    const { totalTvlUSD, totalSwapVolume } = pools.reduce(
      (totals, pool) => {
        const { tvlUSD, swapVolume } = pool;
        totals.totalTvlUSD += tvlUSD;
        totals.totalSwapVolume += swapVolume;
        return totals;
      },
      { totalTvlUSD: 0, totalSwapVolume: 0 }
    );

    const formatTvlUsd = formatNumber(totalTvlUSD);
    const formatVol = formatNumber(totalSwapVolume);

    res.status(200).json({
      totalTvlUsd: formatTvlUsd,
      totalVol: formatVol,
      traders,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get homepage data";

    return next(
      new CustomError(message, statusCode, { context: "getHomeData", error })
    );
  }
};

export { getHomeData };
