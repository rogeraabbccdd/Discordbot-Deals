const exRateUpdate = require('../funcs/exRateUpdate')

let value = 30

const update = async () => {
  value = await exRateUpdate()
}

module.exports = {
  value,
  update
}
