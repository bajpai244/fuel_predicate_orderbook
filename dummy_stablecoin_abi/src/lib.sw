library;

// anything `pub` here will be exported as a part of this library's API

abi DummyStablecoin {
    #[storage(read, write)]
    fn mint(recipient: Identity, sub_id: Option<SubId>, amount: u64);

     #[payable]
    #[storage(read, write)]
    fn burn(sub_id: SubId, amount: u64);
}
