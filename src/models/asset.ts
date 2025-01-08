import { InferAttributes, InferCreationAttributes, Model } from "sequelize";

class Asset extends Model<
  InferAttributes<Asset>,
  InferCreationAttributes<Asset>
> {
  declare asset_id: string;
  declare name?: string;
  declare symbol?: string;
  declare decimals?: number;
  declare icon?: string;
  declare l1_address?: string;
  declare contract_id?: string;
  declare subId?: string;
  declare price_usd: number;
  declare is_verified?: boolean;
}

export default Asset;
