import { InferAttributes, InferCreationAttributes, Model } from "sequelize";

class Pool extends Model<InferAttributes<Pool>, InferCreationAttributes<Pool>> {
  declare pool_id: string;
  declare asset_0: string;
  declare asset_1: string;
  declare is_stable: boolean;
  declare reserve_0: string;
  declare reserve_1: string;
  declare create_time: number;
  declare decimals_0: number;
  declare decimals_1: number;
  declare tvl: bigint;
  declare tvlUSD: number;
  declare lpId: string;
  declare fees24hr: number;
  declare volume24hr: number;
  declare swapVolume: number;
}

export default Pool;
