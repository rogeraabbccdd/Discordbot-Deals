module.exports = (data, name) => data.find((item) => item.title.trim().toUpperCase() === name.trim().toUpperCase())
