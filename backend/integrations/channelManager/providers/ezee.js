const { disabledCapabilities } = require('./disabled');

const createContractError = () => {
  const err = new Error('eZee channel manager contract is not configured');
  err.code = 'EZEE_CONTRACT_NOT_CONFIGURED';
  err.statusCode = 501;
  err.retryable = false;
  return err;
};

const createEzeeProvider = () => ({
  name: 'ezee',
  supportsLiveCalls: false,
  capabilities: disabledCapabilities,

  async getCapabilities() {
    return disabledCapabilities;
  },

  async healthCheck() {
    return {
      ok: false,
      provider: 'ezee',
      configured: Boolean(process.env.EZEE_API_BASE_URL && process.env.EZEE_API_KEY),
      reason: 'official_contract_required',
    };
  },

  async updateAvailability() {
    throw createContractError();
  },

  async updateRates() {
    throw createContractError();
  },

  async createReservation() {
    throw createContractError();
  },

  async modifyReservation() {
    throw createContractError();
  },

  async cancelReservation() {
    throw createContractError();
  },
});

module.exports = {
  createEzeeProvider,
};
