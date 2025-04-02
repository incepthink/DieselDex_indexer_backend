import { NextFunction, Request, Response } from "express";
import { CustomError } from "../utils/error_factory";
import { Pool } from "../models";
import { gql } from "urql";
import { client } from "..";
import Transaction from "../models/transaction";
import { Sequelize } from "sequelize";

const formatNumber = (num: number) => {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1) + "M";
  } else if (num >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num; // For smaller numbers
};

type PoolAggregateResult = {
  totalTvlUSD: number;
  totalSwapVolume: number;
};

const getHomeData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    // Calculate total number of trades directly in the database
    const totalTrades = await Transaction.count();

    // Aggregate total TVL and swap volume directly in the database
    const poolAggregates = (await Pool.findAll({
      attributes: [
        [Sequelize.fn("SUM", Sequelize.col("tvlUSD")), "totalTvlUSD"],
        [Sequelize.fn("SUM", Sequelize.col("swapVolume")), "totalSwapVolume"],
      ],
      raw: true,
    })) as unknown as PoolAggregateResult[];

    const totalTvlUSD = poolAggregates[0]?.totalTvlUSD ?? 0;
    const totalSwapVolume = poolAggregates[0]?.totalSwapVolume ?? 0;

    const formatTvlUsd = formatNumber(totalTvlUSD);
    const formatVol = formatNumber(totalSwapVolume);
    const formatTrades = formatNumber(totalTrades);

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
) => {
  try {
    // Step 1: Identify the most recent transaction in the database
    const latestTransaction = await Transaction.findOne({
      order: [["block_time", "DESC"]],
      attributes: ["block_time"],
    });

    const lastBlockTime = latestTransaction ? latestTransaction.block_time : 0;

    console.log(`🔍 Last processed block time: ${lastBlockTime}`);

    // Step 2: Fetch new transactions from the external source
    const transactionQuery = gql`
      query FetchTransactions($lastBlockTime: Int!) {
        Transaction(
          where: { block_time: { _gt: $lastBlockTime } }
          order_by: { block_time: asc }
          limit: 1000
        ) {
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

    const result = await client.query(transactionQuery, {
      lastBlockTime: lastBlockTime,
    });

    const transactions = result.data.Transaction;

    if (transactions.length === 0) {
      res.status(200).json({
        status: "success",
        message: "No new transactions to process",
      });
      return;
    }

    console.log(`📊 Found ${transactions.length} new transactions to process`);

    // Step 3: Store the new transactions in the database
    await Transaction.bulkCreate(transactions, {
      ignoreDuplicates: true, // Ignore duplicate records
    });

    res.status(200).json({
      status: "success",
      message: `${transactions.length} new transactions added`,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to update transactions from indexer";

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
