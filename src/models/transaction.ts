import { InferAttributes, InferCreationAttributes, Model } from "sequelize";

class Transaction extends Model<
  InferAttributes<Transaction>,
  InferCreationAttributes<Transaction>
> {
  declare id: string;
  declare transaction_type?: string;
  declare pool_id?: string;
  declare block_time?: number;
  declare initiator?: string;
  declare extra?: string;
  declare lp_id?: string;
  declare lp_amount?: number;
  declare is_contract_initiator?: boolean;
  declare asset_0_in?: number;
  declare asset_0_out?: number;
  declare asset_1_in?: number;
  declare asset_1_out?: number;
}

export default Transaction;
