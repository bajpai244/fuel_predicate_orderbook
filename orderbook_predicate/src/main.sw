predicate;

use std::{auth::predicate_address, hash::*, inputs::*, outputs::*, u128::*};

configurable {}

// TODO:
// - add cancellation
// - add partial fill
// - add support for custom sequencer
fn main(
    // id of the asset that we want to recieve
    asset_id_get: AssetId,
    // id of the asset that we want to send
    asset_id_send: AssetId,
    // this is to avoid any dust of any sort
    minimal_output_amount: u64,
    out_index: u64,
) -> bool {
    let in_count = input_count().as_u64();
    let out_count = output_count().as_u64();
    let this_predicate = predicate_address().unwrap();

    let out_asset = output_asset_id(out_index).unwrap();
    let output_amount = output_amount(out_index).unwrap();

    if out_asset != asset_id_get
        || output_amount < minimal_output_amount
    {
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
            let is_owner_predicate = input_coin_owner(i).unwrap() == this_predicate;

            if is_owner_predicate {
                let coin_asset_id = input_asset_id(i).unwrap();

                if coin_asset_id != asset_id_send {
                    return false;
                }
            };
        }

        i += 1;
    }

    return true;
}
