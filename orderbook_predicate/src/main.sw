predicate;

use std::{auth::predicate_address, bytes::*, hash::*, inputs::*, outputs::*, u128::*};
use std::bytes_conversions::b256::*;

configurable {
    ASSET_ID_GET: b256 = 0x0000000000000000000000000000000000000000000000000000000000000000,
    ASSET_ID_SEND: b256 = 0x0000000000000000000000000000000000000000000000000000000000000000,
    MINIMAL_OUTPUT_AMOUNT: u64 = 0,
    RECEPIENT: b256 = 0x0000000000000000000000000000000000000000000000000000000000000000,
}

// TODO:
// - add partial fill
// - add support for custom sequencer
fn main(out_index: u64, // this is the input index of the asset owned by the recepient, signalizing cancellation of the order
 cancel: Option<u64>) -> bool {
    let asset_id_get = AssetId::from(ASSET_ID_GET);
    let asset_id_send = AssetId::from(ASSET_ID_SEND);
    let recepient = Address::from(RECEPIENT);

    match cancel {
        Some(cancel_index) => {
            let cancel_owner = input_coin_owner(cancel_index).unwrap();
            if cancel_owner != recepient {
                return false;
            }
            return true
        },
        _ => {},
    }
    let in_count = input_count().as_u64();
    let predicate_address = predicate_address().unwrap();
    let out_asset = output_asset_id(out_index).unwrap();
    let output_amount = output_amount(out_index).unwrap();

    
    // NOTE: this fails, but the conditions individually are correct
    // if out_asset != asset_id_get || output_amount < MINIMAL_OUTPUT_AMOUNT { 
    //     return false;
    // }
    
    if out_asset != asset_id_get 
    {
        return false;
    }

    if output_amount < MINIMAL_OUTPUT_AMOUNT {
        return false;
    }
    
    
    // check that only the asset_id_send is being used in the transaction from the predicate
    let mut i = 0;
    while i < in_count {
        let is_coin = match input_type(i).unwrap() {
            Input::Coin => true,
            _ => false,
        };
        if is_coin {
            let is_owner_predicate = input_coin_owner(i).unwrap() == predicate_address;
            if is_owner_predicate {
                let coin_asset_id = input_asset_id(i).unwrap();
                if coin_asset_id != asset_id_send {
                    return false;
                }
            };
        }
        i += 1;
    };

    return true
}
