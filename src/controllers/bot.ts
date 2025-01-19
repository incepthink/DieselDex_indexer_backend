import { NextFunction, Request, Response } from "express";
import { gql } from "urql";
import { client } from "..";
import { CustomError } from "../utils/error_factory";
import { getBotData } from "../functions/bot";
import axios from "axios";

const sendDataToBot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.body;

    const transactionQuery = gql`
          query MyQuery {
        Transaction(where: {transaction_type: {_eq: "SWAP"}, id: {_eq: "${id}"}}) {
          asset_0_in
          asset_0_out
          asset_1_in
          asset_1_out
          block_time
          db_write_timestamp
          extra
          id
          is_contract_initiator
          initiator
          lp_amount
          lp_id
          pool_id
          transaction_type
        }
      }
        `;

    //@ts-ignore
    const result = await client.query(transactionQuery);
    const transaction = result.data.Transaction[0];
    const isExtra = Boolean(JSON.parse(transaction.extra));

    if (isExtra) {
      const extraTx = JSON.parse(transaction.extra)[0];
      const [asset_0, asset_1, is_stable] = extraTx.pool_id.split("_");

      const data = await getBotData(asset_0, asset_1, extraTx, id);

      if (data?.eth_in !== 0 && data?.asset_out !== 0) {
        const botCall = await axios.post(
          "https://dieselbot.onrender.com/echo",
          {
            data,
          }
        );
      }

      return res.status(200).json({
        data,
      });
    } else {
      const [asset_0, asset_1, is_stable] = transaction.pool_id.split("_");

      const data = await getBotData(asset_0, asset_1, transaction, id);

      const botCall = await axios.post("https://dieselbot.onrender.com/echo", {
        data,
      });

      console.log("Bot call", botCall.data);

      return res.status(200).json({
        data,
      });
    }
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get transaction data and send to bot";

    return next(
      new CustomError(message, statusCode, { context: "sendDataToBot", error })
    );
  }
};

export { sendDataToBot };
