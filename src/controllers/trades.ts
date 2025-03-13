import { NextFunction, Request, Response } from "express";
import { getValue, storeValue } from "../functions/redis";
import { CustomError } from "../utils/error_factory";
import { convertTradingDataToChartData } from "../functions/trades";
import { queryDB } from "../utils";
import { getBotData } from "../functions/bot";

const getTradingData = async (
  pool_id: string,
  offset: number = 0,
  limit: number = 1000
) => {
  try {
    const cachedData = await getValue(`trades_${pool_id}`);
    console.log(cachedData);

    if (JSON.parse(cachedData).length > 0) {
      console.log("Returning cached data");
      const data = JSON.parse(cachedData);
      console.log("cached data length", data.length);
      return JSON.parse(cachedData);
    }
  } catch (error) {}

  const allResults = [];

  let currentOffset = offset || 0;
  let hasMore = true;

  while (hasMore) {
    const query = `
           query MyQuery($pool_id: String = "0x86fa05e9fef64f76fa61c03f5906c87a03cb9148120b6171910566173d36fc9e_0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07_false", $offset: Int = 0, $limit: Int = 1000) {
                RawSwapEvent(offset: $offset, where: {pool_id: {_eq: $pool_id}}, limit: $limit, order_by: {time: desc}) {
                    asset_0_in
                    asset_0_out
                    asset_1_in
                    asset_1_out
                    block_height
                    db_write_timestamp
                    exchange_rate
                    id
                    is_buy
                    is_sell
                    pool_id
                    recipient
                    time
                    transaction_id
                }

                Transaction(offset: $offset, where: {pool_id: {_eq: $pool_id}}, limit: $limit, order_by: {time: desc}) {
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
  time
                }
            }
        `;

    const variables = {
      pool_id,
      offset: currentOffset,
      limit: limit || 1000, // Keep at 1000 as this is the max supported
    };

    try {
      const response = await queryDB(query, variables);

      const results = response.data.RawSwapEvent;
      const transactions = response.data.Transaction;

      const eth_transactions: any = [];

      transactions.forEach(async (transaction: any) => {
        const isExtra = Boolean(JSON.parse(transaction.extra));
        if (isExtra) {
          const extraTx = JSON.parse(transaction.extra)[0];
          const [asset_0, asset_1, is_stable] = extraTx.pool_id.split("_");

          const data = await getBotData(asset_0, asset_1, extraTx, pool_id);

          if (data?.eth_in !== 0 && data?.asset_out !== 0) {
            eth_transactions.push(data);
          }
        } else {
          const [asset_0, asset_1, is_stable] = transaction.pool_id.split("_");

          const data = await getBotData(asset_0, asset_1, transaction, pool_id);

          if (data?.eth_in !== 0 && data?.asset_out !== 0) {
            const [asset_0, asset_1, is_stable] =
              transaction.pool_id.split("_");

            const data = await getBotData(
              asset_0,
              asset_1,
              transaction,
              pool_id
            );

            if (data?.eth_in !== 0 && data?.asset_out !== 0) {
              eth_transactions.push(data);
            }
          }
        }
      });
      // COntinue here for eth amount for chartTransactionHistory
      console.log("EthTransations::", eth_transactions[0]);

      if (results && results.length > 0) {
        allResults.push(...results);
        currentOffset = currentOffset + Number(results.length);

        // If we got less than 1000 results, we've reached the end
        if (results.length < 1000) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      // Optional: Add a small delay to prevent overwhelming the API
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      hasMore = false; // Stop on error
    }
  }

  await storeValue(`trades_${pool_id}`, JSON.stringify(allResults), 5); // 5 sec cache
  return allResults;
};

export const getTradesData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  const { pool_id, offset, limit } = req.query;

  if (!pool_id) {
    res.status(404).json({
      message: "Pool id not found",
    });
  }

  try {
    const newRawData = await getTradingData(
      String(pool_id),
      Number(offset),
      Number(limit)
    );

    // const data = await convertTradingDataToChartData(newRawData, "24h");

    res.status(200).json({
      message: "Successfully fetched trades",
      data: newRawData,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get trades data";

    return next(
      new CustomError(message, statusCode, { context: "getTradesData", error })
    );
  }
};
