import dbConfig from "../config/config";
import { DataTypes, Sequelize } from "sequelize";
import Pool from "./pool";
import Asset from "./asset";
import Transaction from "./transaction";

const sequelize = new Sequelize(
  dbConfig.production.database,
  dbConfig.production.username,
  dbConfig.production.password,
  {
    host: dbConfig.production.host,
    //@ts-ignore
    dialect: dbConfig.production.dialect,
  }
);

Asset.init(
  {
    asset_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
    },
    name: DataTypes.STRING,
    symbol: DataTypes.STRING,
    decimals: DataTypes.INTEGER,
    icon: DataTypes.STRING,
    l1_address: DataTypes.STRING,
    contract_id: DataTypes.STRING,
    subId: DataTypes.STRING,
    price_usd: DataTypes.FLOAT,
    is_verified: DataTypes.BOOLEAN,
  },
  {
    sequelize,
    modelName: "Asset",
    tableName: "assets",
    indexes: [
      {
        unique: true,
        fields: ["symbol"],
      },
      {
        fields: ["price_usd"],
      },
    ],
  }
);

Pool.init(
  {
    pool_id: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
    },
    asset_0: DataTypes.STRING,
    asset_1: DataTypes.STRING,
    is_stable: DataTypes.BOOLEAN,
    reserve_0: DataTypes.STRING,
    reserve_1: DataTypes.STRING,
    create_time: DataTypes.INTEGER,
    decimals_0: DataTypes.INTEGER,
    decimals_1: DataTypes.INTEGER,
    tvl: DataTypes.BIGINT,
    tvlUSD: DataTypes.FLOAT,
    lpId: DataTypes.STRING,
    fees24hr: DataTypes.FLOAT,
    volume24hr: DataTypes.FLOAT,
    swapVolume: DataTypes.FLOAT,
  },
  {
    sequelize,
    modelName: "Pool",
    tableName: "pools",
    indexes: [
      {
        fields: ["asset_0"],
      },
      {
        fields: ["asset_1"],
      },
      {
        fields: ["create_time"],
      },
      {
        unique: true,
        fields: ["asset_0", "asset_1"],
      },
    ],
  }
);

Transaction.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
    },
    transaction_type: DataTypes.STRING,
    pool_id: DataTypes.STRING,
    initiator: DataTypes.STRING,
    is_contract_initiator: DataTypes.BOOLEAN,
    asset_0_in: DataTypes.BIGINT,
    asset_0_out: DataTypes.BIGINT,
    asset_1_in: DataTypes.BIGINT,
    asset_1_out: DataTypes.BIGINT,
    block_time: DataTypes.INTEGER,
    extra: DataTypes.STRING,
    lp_id: DataTypes.STRING,
    lp_amount: DataTypes.STRING,
  },
  {
    sequelize,
    modelName: "Transaction",
    tableName: "transactions",
  }
);

const defineAssociations = () => {
  Pool.belongsTo(Asset, {
    foreignKey: "asset_0",
    as: "Asset0",
  });
  Pool.belongsTo(Asset, {
    foreignKey: "asset_1",
    as: "Asset1",
  });
};

defineAssociations();

export { Pool, Asset };
export default sequelize;
