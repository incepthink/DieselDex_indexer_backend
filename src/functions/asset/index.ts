import { NextFunction } from "express";
import { Asset } from "../../models";
import { CustomError } from "../../utils/error_factory";
import { AssetType } from "../../types/modelTypes";

export const addAsset = async (asset: AssetType, next: NextFunction) => {
  try {
    const toAdd = {
      asset_id: asset.asset_id,
      name: asset.name,
      symbol: asset.symbol,
      decimals: asset.decimals,
      icon: asset.icon,
      l1_address: asset.l1_address,
      contract_id: asset.contract_id,
      subId: asset.subId,
      price_usd: asset.price,
      is_verified: asset.is_verified,
    };

    //@ts-ignore
    const [newAsset, created] = await Asset.findOrCreate({
      where: {
        asset_id: asset.asset_id,
      },
      defaults: toAdd,
    });

    if (!created) {
      newAsset.name = asset.name;
      newAsset.symbol = asset.symbol;
      newAsset.decimals = asset.decimals;
      newAsset.icon = asset.icon;
      newAsset.l1_address = asset.l1_address;
      newAsset.contract_id = asset.contract_id;
      newAsset.subId = asset.subId;
      newAsset.price_usd = asset.price;
      newAsset.is_verified = asset.is_verified;
    }

    newAsset.save();

    return newAsset;
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to getAsset from db";

    return next(
      new CustomError(message, statusCode, { context: "addAsset", error })
    );
  }
};
