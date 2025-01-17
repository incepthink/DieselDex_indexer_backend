import { gql } from "urql";
import { Asset } from "../models";
import { CustomError } from "../utils/error_factory";
import { client } from "..";
import { NextFunction, Request, Response } from "express";
import { addAsset } from "../functions/asset";

type AssetResponse = {
  id: string;
  price_usd: number;
};

const getExchangeRateByAssetId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { id } = req.body;

    const exchangeRateQuery = gql`
      query MyQuery {
    Asset(where: {id: {_eq: "${id}"}}) {
      id
      exchange_rate_eth
      exchange_rate_fuel
      exchange_rate_usdc
    }
  }
    `;

    //@ts-ignore
    const result = await client.query(exchangeRateQuery);
    const data = result.data.Asset[0];

    res.status(200).json({
      data,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get asset exchange rate";

    return next(
      new CustomError(message, statusCode, {
        context: "getExchangeRateByAssetId",
        error,
      })
    );
  }
};

const getAssets = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const asset_query = gql`
      query MyQuery {
        Asset {
          id
        }
      }
    `;

    //@ts-ignore
    const result = await client.query(asset_query);
    const assetsPrice = await result.data.Asset;

    assetsPrice.forEach(async (asset: AssetResponse) => {
      const toAdd = {
        asset_id: asset.id,
      };

      const [assetDB, created] = await Asset.findOrCreate({
        where: {
          asset_id: asset.id,
        },
        defaults: toAdd,
      });

      // if (!created) {
      //   assetDB.price_usd = asset.price_usd;
      // }

      assetDB.save();
    });

    const assets = await Asset.findAll();
    return res.status(200).json({
      assets,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get assets";

    return next(
      new CustomError(message, statusCode, { context: "getAssets", error })
    );
  }
};

const addAssets = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const assets = req.body.assets;

    const toSend = [];
    for (const asset of assets) {
      const newAsset = await addAsset(asset, next);
      toSend.push(newAsset);
    }

    return res.status(201).json({
      assetsAdded: toSend,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to add assets";

    return next(
      new CustomError(message, statusCode, { context: "addAssets", error })
    );
  }
};

const getAssetById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const id = req.params.id;

    const asset = await Asset.findByPk(id);

    return res.status(200).json({
      asset,
    });
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to get asset by id";

    return next(
      new CustomError(message, statusCode, { context: "getAssetById", error })
    );
  }
};

export { getAssets, addAssets, getAssetById, getExchangeRateByAssetId };
