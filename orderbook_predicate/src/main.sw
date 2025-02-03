predicate;

use std::{auth::predicate_address, hash::*, inputs::*, outputs::*, u128::*};

configurable {
    ORDER_HASH: b256 = 0x09c0b2d1a486c439a87bcba6b46a7a1a23f3897cc83a94521a96da5c23bc58db,
}

fn main(
    minimal_input_amount: u64,
    minimal_output_amount: u64,
    out_index: u64,
    sequencer_index: u64,
    cancel: Option<(u64, u64)>,
) -> bool {
    let in_count = input_count().as_u64();
    let out_count = output_count().as_u64();
    let this_predicate = predicate_address().unwrap();
    let out_asset = output_asset_id(out_index).unwrap();

    let mut in_asset = AssetId::default();
    let mut input_index = 0;
    let mut output_index = 0;
    let mut total_in = 0;
    let mut total_out_recipient_in: u64 = 0;
    let mut total_out_recipient_out: u64 = 0;
    let mut total_out_predicate_in: u64 = 0;
    let mut will_cancel: bool = false;

    let sequencer = input_coin_owner(sequencer_index).unwrap();

    let recipient_address = match input_coin_owner(out_index) {
        Some(recipient) => recipient,
        None => Address::zero(),
    };

    while input_index < in_count {
        let is_predicate = match input_coin_owner(input_index) {
            Some(predicate_address) => predicate_address == this_predicate,
            None => false,
        };

        let is_coin = match input_type(input_index).unwrap() {
            Input::Coin => true,
            _ => false,
        };

        let is_recipient = match input_coin_owner(input_index) {
            Some(recipient) => recipient == recipient_address,
            None => false,
        };

        let is_in_asset = match input_asset_id(input_index) {
            Some(asset_id) => {
                if in_asset == AssetId::default()
                    && is_predicate
                    && is_coin
                {
                    in_asset = asset_id;
                }

                return in_asset == asset_id;
            },
            None => false,
        };

        if is_coin && is_predicate && is_in_asset {
            let amount = input_amount(input_index).unwrap();

            total_in = total_in + amount;
        }

        match cancel {
            Some(_) => {
                if is_recipient {
                    will_cancel = true;
                }
            },
            None => {},
        }

        input_index = input_index + 1;
    }

    while output_index < out_count {
        let is_coin = match output_type(output_index).unwrap() {
            Output::Coin => true,
            _ => false,
        };

        let is_predicate = match output_asset_to(output_index) {
            Some(owner_address) => owner_address == this_predicate,
            None => false,
        };

        let is_recipient = match output_asset_to(output_index) {
            Some(recipient) => recipient == recipient_address,
            None => false,
        };

        let is_in_asset = match output_asset_id(output_index) {
            Some(asset_id) => asset_id == in_asset,
            None => false,
        };

        let is_out_asset = match output_asset_id(output_index) {
            Some(asset_id) => asset_id == out_asset,
            None => false,
        };

        if (is_coin) {
            let amount = output_amount(output_index).unwrap();

            if is_predicate && is_in_asset {
                total_out_predicate_in = total_out_predicate_in + amount;
            }

            if is_recipient && is_in_asset {
                total_out_recipient_in = total_out_recipient_in + amount;
            }

            if is_recipient && is_out_asset {
                assert(amount >= minimal_output_amount);

                total_out_recipient_out = total_out_recipient_out + amount;
            }
        }

        output_index = output_index + 1;
    }

    let mut numerator = 0;
    let mut denominator = 0;

    match cancel {
        Some(values) => {
            numerator = values.0;
            denominator = values.1;
        },
        None => {
            let mut gcd = total_in;
            let mut b = total_out_recipient_out;
            let mut remainder = 0;

            while (b != 0) {
                remainder = gcd % b;
                gcd = b;
                b = remainder;
            }

            numerator = total_in / gcd;
            denominator = total_out_recipient_out / gcd;
        }
    }

    let remainder_is_correct = U128::from(total_in) - (U128::from(total_in) * U128::from(numerator)) / U128::from(denominator) == U128::from(total_out_predicate_in);

    sha256((
        (numerator, denominator, minimal_input_amount),
        (recipient_address, in_asset, out_asset, sequencer),
    )) == ORDER_HASH && ((will_cancel && total_in >= total_out_recipient_in) || remainder_is_correct)
}
