// Stability Pool Yield Adapter for Vault C
// Wraps the StabilityPool contract for standardized yield access

#[starknet::contract]
pub mod SPAdapter {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use openzeppelin_token::erc20::interface::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_access::ownable::OwnableComponent;
    use moonight::interfaces::i_stability_pool::{IStabilityPoolDispatcher, IStabilityPoolDispatcherTrait};

    component!(path: OwnableComponent, storage: ownable, event: OwnableEvent);

    #[abi(embed_v0)]
    impl OwnableImpl = OwnableComponent::OwnableMixinImpl<ContractState>;
    impl OwnableInternalImpl = OwnableComponent::InternalImpl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        ownable: OwnableComponent::Storage,
        vault: ContractAddress,
        stability_pool: ContractAddress,
        moonusd_token: ContractAddress,
        deployed_capital: u256,
        last_apy_bps: u256,
        active: bool,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        OwnableEvent: OwnableComponent::Event,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        vault: ContractAddress,
        stability_pool: ContractAddress,
        moonusd_token: ContractAddress,
    ) {
        self.ownable.initializer(owner);
        self.vault.write(vault);
        self.stability_pool.write(stability_pool);
        self.moonusd_token.write(moonusd_token);
        self.active.write(true);
        self.last_apy_bps.write(850); // Default 8.5% estimate
    }

    #[abi(embed_v0)]
    impl YieldAdapterImpl of moonight::interfaces::i_yield_adapter::IYieldAdapter<ContractState> {
        fn deploy(ref self: ContractState, amount: u256) {
            assert(get_caller_address() == self.vault.read(), 'Only vault');
            assert(self.active.read(), 'Adapter inactive');

            let sp_addr = self.stability_pool.read();
            let token = IERC20Dispatcher { contract_address: self.moonusd_token.read() };

            // Transfer moonUSD from vault to this adapter
            token.transfer_from(self.vault.read(), get_contract_address(), amount);

            // Approve and deposit into SP
            token.approve(sp_addr, amount);
            let sp = IStabilityPoolDispatcher { contract_address: sp_addr };
            sp.deposit(amount);

            self.deployed_capital.write(self.deployed_capital.read() + amount);
        }

        fn withdraw(ref self: ContractState, amount: u256) -> u256 {
            assert(get_caller_address() == self.vault.read(), 'Only vault');

            let capital = self.deployed_capital.read();
            let withdraw_amount = if amount <= capital { amount } else { capital };

            if withdraw_amount == 0 {
                return 0;
            }

            let sp = IStabilityPoolDispatcher { contract_address: self.stability_pool.read() };
            sp.withdraw(withdraw_amount);

            // Transfer withdrawn moonUSD back to vault
            let token = IERC20Dispatcher { contract_address: self.moonusd_token.read() };
            token.transfer(self.vault.read(), withdraw_amount);

            self.deployed_capital.write(capital - withdraw_amount);
            withdraw_amount
        }

        fn harvest(ref self: ContractState) -> u256 {
            assert(get_caller_address() == self.vault.read(), 'Only vault');

            let token = IERC20Dispatcher { contract_address: self.moonusd_token.read() };
            let balance_before = token.balance_of(get_contract_address());

            // Claim interest yield from SP
            let sp = IStabilityPoolDispatcher { contract_address: self.stability_pool.read() };
            sp.claim_interest_yield();

            let balance_after = token.balance_of(get_contract_address());
            let yield_amount = if balance_after > balance_before {
                balance_after - balance_before
            } else {
                0
            };

            // Transfer yield to vault
            if yield_amount > 0 {
                token.transfer(self.vault.read(), yield_amount);
            }

            yield_amount
        }

        fn get_deployed_capital(self: @ContractState) -> u256 {
            self.deployed_capital.read()
        }

        fn get_current_apy_bps(self: @ContractState) -> u256 {
            self.last_apy_bps.read()
        }

        fn is_active(self: @ContractState) -> bool {
            self.active.read()
        }
    }

    #[external(v0)]
    fn set_apy_bps(ref self: ContractState, apy_bps: u256) {
        self.ownable.assert_only_owner();
        self.last_apy_bps.write(apy_bps);
    }

    #[external(v0)]
    fn set_active(ref self: ContractState, active: bool) {
        self.ownable.assert_only_owner();
        self.active.write(active);
    }
}
