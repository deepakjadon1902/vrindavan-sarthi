const createProviderContractError = (provider) => {
  const err = new Error(`${provider} channel provider contract is not configured`);
  err.code = 'PROVIDER_CONTRACT_NOT_CONFIGURED';
  err.statusCode = 501;
  err.retryable = false;
  return err;
};

const disabledCapabilities = Object.freeze({
  availability: false,
  rates: false,
  restrictions: false,
  reservations: false,
  modifications: false,
  cancellations: false,
  webhooks: false,
  idempotency: false,
});

const createDisabledProvider = (name) => ({
  name,
  supportsLiveCalls: false,
  capabilities: disabledCapabilities,

  async getCapabilities() {
    return disabledCapabilities;
  },

  async healthCheck() {
    return {
      ok: false,
      provider: name,
      configured: false,
      reason: 'official_contract_required',
    };
  },

  async getHotel() {
    throw createProviderContractError(name);
  },

  async getRoomTypes() {
    throw createProviderContractError(name);
  },

  async getRatePlans() {
    throw createProviderContractError(name);
  },

  async getAvailability() {
    throw createProviderContractError(name);
  },

  async getRates() {
    throw createProviderContractError(name);
  },

  async updateAvailability() {
    throw createProviderContractError(name);
  },

  async updateRates() {
    throw createProviderContractError(name);
  },

  async createReservation() {
    throw createProviderContractError(name);
  },

  async modifyReservation() {
    throw createProviderContractError(name);
  },

  async cancelReservation() {
    throw createProviderContractError(name);
  },
});

module.exports = {
  createDisabledProvider,
  disabledCapabilities,
};
