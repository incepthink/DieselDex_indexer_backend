import { NextFunction } from "express";
import { Asset, Pool } from "../../models";
import { CustomError } from "../../utils/error_factory";
import { gql } from "urql";
import { client } from "../..";
import { PoolType } from "../../types/modelTypes";

export const addPool = async (pool: PoolType, next: NextFunction) => {
  try {
    const toAdd = {
      pool_id: pool.id,
      asset_0: pool.asset_0,
      asset_1: pool.asset_1,
      create_time: pool.create_time,
      is_stable: pool.is_stable,
      reserve_0: pool.reserve_0,
      reserve_1: pool.reserve_1,
      decimals_0: pool.decimals_0,
      decimals_1: pool.decimals_1,
      tvl: pool.tvl,
      tvlUSD: pool.tvlUSD,
    };

    const [newPool, created] = await Pool.findOrCreate({
      where: {
        pool_id: pool.id,
      },
      defaults: toAdd,
    });

    if (!created) {
      newPool.is_stable = pool.is_stable;
      newPool.reserve_0 = pool.reserve_0;
      newPool.reserve_1 = pool.reserve_1;
      newPool.tvl = pool.tvl;
      newPool.tvlUSD;
    }

    newPool.save();

    const newPoolWithAssets = await Pool.findByPk(newPool.pool_id, {
      include: [
        {
          model: Asset,
          as: "Asset0",
          attributes: ["asset_id", "name", "symbol", "icon", "price_usd"],
        },
        {
          model: Asset,
          as: "Asset1",
          attributes: ["asset_id", "name", "symbol", "icon", "price_usd"],
        },
      ],
    });

    return newPoolWithAssets;
  } catch (error) {
    const statusCode = 500;
    const message = "Failed to getPool from db";

    return next(
      new CustomError(message, statusCode, { context: "addPool", error })
    );
  }
};
