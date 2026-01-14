-- Logger fix for Prometheus
local logger = {}

function logger.info(...)
    -- Do nothing, silent mode
end

function logger.warn(...)
    -- Do nothing
end

function logger.error(...)
    -- Do nothing
end

function logger.success(...)
    -- Do nothing
end

function logger.log(...)
    -- Do nothing
end

return logger
