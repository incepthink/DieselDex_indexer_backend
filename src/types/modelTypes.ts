export type PoolType = {
  asset_0: string;
  asset_1: string;
  id: string;
  create_time: number;
  decimals_0: number;
  decimals_1: number;
  reserve_0: string;
  reserve_1: string;
  is_stable: boolean;
  tvl: bigint;
  tvlUSD: number;
};

export type AssetType = {
  asset_id: string;
  name: string;
  symbol: string;
  decimals: number;
  icon: string;
  l1_address: string;
  contract_id: string;
  subId: string;
  price: number;
  is_verified: boolean;
};
