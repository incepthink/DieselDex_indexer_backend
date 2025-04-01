import { NextFunction, Request, Response } from "express";
import { getValue, storeValue } from "../functions/redis";
import { CustomError } from "../utils/error_factory";
import { convertTradingDataToChartData } from "../functions/trades";
import { queryDB } from "../utils";
import { getBotData } from "../functions/bot";
import { DATA_TTL } from "../functions/asset";

const getTradingData = async (
  pool_id: string,
  offset: number = 0,
  limit: number = 1000
) => {
  // Load previously cached trades and latest known timestamp
  let cachedData = [];
  let lastTimestamp = 0;

  try {
    const rawCache = await getValue(`trades_${pool_id}`);
    if (rawCache) {
      cachedData = JSON.parse(rawCache);
      console.log(`Loaded ${cachedData.length} cached trades`);

      // Get the latest timestamp from cache (assuming data sorted by time DESC)
      lastTimestamp = cachedData[0]?.time || 0;
    }
  } catch (err) {
    console.warn("Cache fetch error:", err);
  }

  const allNewResults = [];
  let currentOffset = 0;
  let hasMore = true;

  while (hasMore) {
    // GraphQL query to fetch only new transactions after the cached timestamp
    const query = `
      query NewTrades($pool_id: String! = "0x86fa05e9fef64f76fa61c03f5906c87a03cb9148120b6171910566173d36fc9e_0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07_false", $offset: Int! = 0, $limit: Int! = 0, $last_time: Int! = 0) {
        RawSwapEvent(
          offset: $offset, 
          where: {
            pool_id: {_eq: $pool_id},
            time: {_gt: $last_time}
          },
          limit: $limit, 
          order_by: {time: desc}
        ) {
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

        Transaction(
          offset: $offset,
          where: {
            pool_id: {_eq: $pool_id},
            block_time: {_gt: $last_time}
          },
          limit: $limit,
          order_by: {block_time: desc}
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

    const variables = {
      pool_id,
      offset: currentOffset,
      limit,
      last_time: lastTimestamp,
    };

    try {
      const response = await queryDB(query, variables);
      console.log(response);

      const newTrades = response.data.RawSwapEvent || [];
      const newTransactions = response.data.Transaction || [];

      // Process the new Transaction data (optional, use as needed)
      const ethTransactions: any[] = [];

      for (const tx of newTransactions) {
        let data;
        const isExtra = Boolean(tx.extra && JSON.parse(tx.extra));

        if (isExtra) {
          const extraTx = JSON.parse(tx.extra)[0];
          const [asset_0, asset_1] = extraTx.pool_id.split("_");
          data = await getBotData(asset_0, asset_1, extraTx, pool_id);
        } else {
          const [asset_0, asset_1] = tx.pool_id.split("_");
          data = await getBotData(asset_0, asset_1, tx, pool_id);
        }

        if (data?.eth_in !== 0 && data?.asset_out !== 0) {
          ethTransactions.push(data);
        }
      }

      if (newTrades.length > 0) {
        allNewResults.push(...newTrades);
        currentOffset += newTrades.length;

        // If fewer than limit, we've reached the end
        if (newTrades.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      // Small delay to avoid rate limits
      await new Promise((res) => setTimeout(res, 100));
    } catch (error) {
      console.error("Error fetching data from indexer:", error);
      hasMore = false;
    }
  }

  // Combine new results with cached ones
  const combinedData = [...allNewResults, ...cachedData];

  // Optional: sort again by `time` descending (latest first)
  combinedData.sort((a, b) => b.time - a.time);

  // Save updated cache without TTL (infinite)
  await storeValue(`trades_${pool_id}`, JSON.stringify(combinedData), DATA_TTL);

  return combinedData;
};

// const getTradingData = async (
//   pool_id: string,
//   offset: number = 0,
//   limit: number = 1000
// ) => {
//   try {
//     const cachedData = await getValue(`trades_${pool_id}`);
//     console.log(cachedData);

//     if (JSON.parse(cachedData).length > 0) {
//       console.log("Returning cached data");
//       const data = JSON.parse(cachedData);
//       console.log("cached data length", data.length);
//       return JSON.parse(cachedData);
//     }
//   } catch (error) {}

//   const allResults = [];

//   let currentOffset = offset || 0;
//   let hasMore = true;

//   while (hasMore) {
//     const query = `
//            query MyQuery($pool_id: String = "0x86fa05e9fef64f76fa61c03f5906c87a03cb9148120b6171910566173d36fc9e_0xf8f8b6283d7fa5b672b530cbb84fcccb4ff8dc40f8176ef4544ddb1f1952ad07_false", $offset: Int = 0, $limit: Int = 1000) {
//                 RawSwapEvent(offset: $offset, where: {pool_id: {_eq: $pool_id}}, limit: $limit, order_by: {time: desc}) {
//                     asset_0_in
//                     asset_0_out
//                     asset_1_in
//                     asset_1_out
//                     block_height
//                     db_write_timestamp
//                     exchange_rate
//                     id
//                     is_buy
//                     is_sell
//                     pool_id
//                     recipient
//                     time
//                     transaction_id
//                 }

//                 Transaction(offset: $offset, where: {pool_id: {_eq: $pool_id}}, limit: $limit, order_by: {block_time: desc}) {
//                   id
//   transaction_type
//   pool_id
//   initiator
//   is_contract_initiator
//   asset_0_in
//   asset_0_out
//   asset_1_in
//   asset_1_out
//   block_time
//   extra
//   lp_id
//   lp_amount
//                 }
//             }
//         `;

//     const variables = {
//       pool_id,
//       offset: currentOffset,
//       limit: limit || 1000, // Keep at 1000 as this is the max supported
//     };

//     try {
//       const response = await queryDB(query, variables);
//       console.log(response);

//       const results = response.data.RawSwapEvent;
//       const transactions = response.data.Transaction;

//       const eth_transactions: any = [];

//       transactions.forEach(async (transaction: any) => {
//         const isExtra = Boolean(JSON.parse(transaction.extra));
//         if (isExtra) {
//           const extraTx = JSON.parse(transaction.extra)[0];
//           const [asset_0, asset_1, is_stable] = extraTx.pool_id.split("_");

//           const data = await getBotData(asset_0, asset_1, extraTx, pool_id);

//           if (data?.eth_in !== 0 && data?.asset_out !== 0) {
//             eth_transactions.push(data);
//           }
//         } else {
//           const [asset_0, asset_1, is_stable] = transaction.pool_id.split("_");

//           const data = await getBotData(asset_0, asset_1, transaction, pool_id);

//           if (data?.eth_in !== 0 && data?.asset_out !== 0) {
//             const [asset_0, asset_1, is_stable] =
//               transaction.pool_id.split("_");

//             const data = await getBotData(
//               asset_0,
//               asset_1,
//               transaction,
//               pool_id
//             );

//             if (data?.eth_in !== 0 && data?.asset_out !== 0) {
//               eth_transactions.push(data);
//             }
//           }
//         }
//       });
//       // COntinue here for eth amount for chartTransactionHistory
//       console.log("EthTransations::", eth_transactions[0]);

//       if (results && results.length > 0) {
//         allResults.push(...results);
//         currentOffset = currentOffset + Number(results.length);

//         // If we got less than 1000 results, we've reached the end
//         if (results.length < 1000) {
//           hasMore = false;
//         }
//       } else {
//         hasMore = false;
//       }

//       // Optional: Add a small delay to prevent overwhelming the API
//       await new Promise((resolve) => setTimeout(resolve, 100));
//     } catch (error) {
//       hasMore = false; // Stop on error
//     }
//   }

//   await storeValue(`trades_${pool_id}`, JSON.stringify(allResults), 5); // 5 sec cache
//   return allResults;
// };

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
