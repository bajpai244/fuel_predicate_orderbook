contract;
 
use standards::src3::SRC3;
use standards::src20::{SetDecimalsEvent, SetNameEvent, SetSymbolEvent, SRC20, TotalSupplyEvent};
use std::{hash::Hash, storage::storage_string::*, string::String};
use std::{
    asset::{
        burn,
        mint_to,
    },
    auth::msg_sender,
    call_frames::msg_asset_id,
    constants::DEFAULT_SUB_ID,
    context::msg_amount,
};
 
storage {
    /// The total number of distinguishable assets minted by this contract.
    total_assets: u64 = 0,
    /// The total supply of coins for a specific asset minted by this contract.
    total_supply: u64 = 0,
    /// The name of a specific asset minted by this contract.
    name:  StorageString = StorageString {},
    /// The symbol of a specific asset minted by this contract.
    symbol: StorageString = StorageString {},
    /// The decimals of a specific asset minted by this contract.
    decimals: u8 = 0,
}


impl SRC3 for Contract {
    #[storage(read, write)]
    fn mint(recipient: Identity, sub_id: Option<SubId>, amount: u64) {
        // require(
        //     sub_id
        //         .is_some() && sub_id
        //         .unwrap() == DEFAULT_SUB_ID,
        //     "Incorrect Sub Id",
        // );
 
        // Increment total supply of the asset and mint to the recipient.
        let new_supply = amount + storage.total_supply.read();
        storage.total_supply.write(new_supply);
 
        mint_to(recipient, DEFAULT_SUB_ID, amount);
 
        TotalSupplyEvent::new(AssetId::default(), new_supply, msg_sender().unwrap())
            .log();
    }
 
   
    #[payable]
    #[storage(read, write)]
    fn burn(sub_id: SubId, amount: u64) {
        require(sub_id == DEFAULT_SUB_ID, "Incorrect Sub Id");
        require(msg_amount() >= amount, "Incorrect amount provided");
        require(
            msg_asset_id() == AssetId::default(),
            "Incorrect asset provided",
        );
 
        // Decrement total supply of the asset and burn.
        let new_supply = storage.total_supply.read() - amount;
        storage.total_supply.write(new_supply);
 
        burn(DEFAULT_SUB_ID, amount);
 
        TotalSupplyEvent::new(AssetId::default(), new_supply, msg_sender().unwrap())
            .log();
    }
}

 
impl SRC20 for Contract {
    #[storage(read)]
    fn total_assets() -> u64 {
        storage.total_assets.read()
    }
 
    #[storage(read)]
    fn total_supply(asset: AssetId) -> Option<u64> {
        storage.total_supply.try_read()
    }
 
    #[storage(read)]
    fn name(asset: AssetId) -> Option<String> {
        storage.name.read_slice()
    }
   
    #[storage(read)]
    fn symbol(asset: AssetId) -> Option<String> {
        storage.symbol.read_slice()
    }
 
    #[storage(read)]
    fn decimals(asset: AssetId) -> Option<u8> {
        storage.decimals.try_read()
    }
}
 
abi SetSRC20Data {
    #[storage(read, write)]
    fn set_src20_data(
        asset: AssetId,
        total_supply: u64,
        name: Option<String>,
        symbol: Option<String>,
        decimals: u8,
    );
}
 
impl SetSRC20Data for Contract {
    #[storage(read, write)]
    fn set_src20_data(
        asset: AssetId,
        supply: u64,
        name: Option<String>,
        symbol: Option<String>,
        decimals: u8,
    ) {
        // NOTE: There are no checks for if the caller has permissions to update the metadata
        // If this asset does not exist, revert
        // if storage.total_supply.get(asset).try_read().is_none() {
        //     revert(0);
        // }
        let sender = msg_sender().unwrap();
 
        match name {
            Some(unwrapped_name) => {
                storage.name.write_slice(unwrapped_name);
                SetNameEvent::new(asset, name, sender).log();
            },
            None => {
                let _ = storage.name.clear();
                SetNameEvent::new(asset, name, sender).log();
            }
        }
 
        match symbol {
            Some(unwrapped_symbol) => {
                storage.symbol.write_slice(unwrapped_symbol);
                SetSymbolEvent::new(asset, symbol, sender).log();
            },
            None => {
                let _ = storage.symbol.clear();
                SetSymbolEvent::new(asset, symbol, sender).log();
            }
        }
 
        storage.decimals.write(decimals);
        SetDecimalsEvent::new(asset, decimals, sender).log();
 
        storage.total_supply.write(supply);
        TotalSupplyEvent::new(asset, supply, sender).log();
    }
}
 