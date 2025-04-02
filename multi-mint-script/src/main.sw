script;

use dummy_stablecoin_abi::DummyStablecoin;

pub struct MintConfig {
    usdc_contract_address: b256,
    fuel_contract_address: b256,
    eth_contract_address: b256,
    btc_contract_address: b256,
    recipient: b256
}

fn main(
    config: MintConfig
) -> u64 {

    let usdc_contract = abi(DummyStablecoin, config.usdc_contract_address);
    let fuel_contract = abi(DummyStablecoin, config.fuel_contract_address);
    let eth_contract = abi(DummyStablecoin, config.eth_contract_address);
    let btc_contract = abi(DummyStablecoin, config.btc_contract_address);

    // 100 usdc
    usdc_contract.mint(Identity::Address(Address::from(config.recipient)), None, 100_000000000);
    // 10000 fuel
    fuel_contract.mint(Identity::Address(Address::from(config.recipient)), None, 10_000_000000000);
    // 0.1 eth
    eth_contract.mint(Identity::Address(Address::from(config.recipient)), None, 100000000);
    // 0.1 btc
    btc_contract.mint(Identity::Address(Address::from(config.recipient)), None, 100000000);

    0
}
