import { NextFunction, Request, Response } from "express";
import { CustomError } from "../utils/error_factory";
import { Pool } from "../models";
import { gql } from "urql";
import { client } from "..";
import Transaction from "../models/transaction";

const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num; // For smaller numbers
};

const getHomeData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const trades = await Transaction.findAll();

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
    const formatTrades = formatNumber(trades.length);

    res.status(200).json({
      totalTvlUsd: formatTvlUsd,
      totalVol: formatVol,
      trades: formatTrades,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get homepage data";

    return next(
      new CustomError(message, statusCode, { context: "getHomeData", error })
    );
  }
};

const getUserTransactionsByAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { address } = req.params;

    if (!address) {
      const statusCode = 500;
      const message = "Please provide an address";

      return next(
        new CustomError(message, statusCode, {
          context: "getUserTransactionsByAddress",
        })
      );
    }

    const transactionQuery = gql`
      query MyQuery {
        Transaction(where: { initiator: { _eq: "${address.toLowerCase()}" } }, limit: 200, offset: 0, order_by: {block_time: asc}) {
          asset_0_in
          asset_0_out
          asset_1_in
          asset_1_out
          block_time
          pool_id
          transaction_type
          initiator
          extra
        }
      }
    `;

    //@ts-ignore
    const result = await client.query(transactionQuery);

    const transactions = result.data.Transaction;

    for (const transaction of transactions) {
      const isExtra = Boolean(JSON.parse(transaction.extra));

      if (isExtra) {
        const extraTx = JSON.parse(transaction.extra)[0];
        if (transaction.asset_0_in > 0) {
          const tx_in = transaction.pool_id.split("_")[0];
          const extraTx_out = extraTx.pool_id.split("_")[0];

          transaction.asset_1_out = extraTx.asset_0_out;
          transaction.pool_id = `${tx_in}_${extraTx_out}_false`;
        }

        console.log(transaction);
      }
    }

    return res.status(200).json({
      transactions,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get user transactions by Address";

    return next(
      new CustomError(message, statusCode, {
        context: "getUserTransactionsByAddress",
        error,
      })
    );
  }
};

const updateTransactionsFromIndexer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  let hasMore = true;
  try {
    let currentOffset = 0;
    const newTransactions = [];

    while (hasMore) {
      const transactionQuery = gql`
        query MyQuery($offset: Int = 0) {
          Transaction(offset: $offset) {
            id
            transaction_type
            pool_id
            initiator
            is_contract_initiator
            asset_0_in
            asset_0_out
            asset_1_in
            asset_1_out
            block_time
            extra
            lp_id
            lp_amount
          }
        }
      `;

      //@ts-ignore
      const result = await client.query(transactionQuery, {
        offset: currentOffset,
      });

      const transactions = result.data.Transaction;
      console.log(hasMore, transactions.length);

      newTransactions.push(...transactions);

      if (transactions && transactions.length > 0) {
        currentOffset = currentOffset + Number(transactions.length);

        if (Number(transactions.length) < 1000) {
          hasMore = false;
        } else {
          hasMore = true;
        }
      }
    }
    await Transaction.bulkCreate(newTransactions, {
      validate: true, // Validate each transaction object before inserting
      ignoreDuplicates: true, // Ignore duplicate records if needed
    });

    res.status(200).json({
      status: "success",
      message: `${newTransactions.length} transactions added`,
    });
  } catch (error) {
    hasMore = false;
    const statusCode = 500;
    const message = "Failed to update transations from indexer";

    return next(
      new CustomError(message, statusCode, {
        context: "updateTransactionsFromIndexer",
        error,
      })
    );
  }
};

export {
  getHomeData,
  getUserTransactionsByAddress,
  updateTransactionsFromIndexer,
};
