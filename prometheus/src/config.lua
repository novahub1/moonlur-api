-- Config module for Prometheus
local config = {}

-- Re-export presets
local presets = require("presets")

for k, v in pairs(presets) do
    config[k] = v
end

return config
