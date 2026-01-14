-- Fixed Logger - Silent Mode
local logger = {}

logger.LogLevel = {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    SUCCESS = 4
}

function logger.log(level, ...)
    -- Silent mode, do nothing
end

function logger.info(...)
    -- Silent mode
end

function logger.warn(...)
    -- Silent mode
end

function logger.error(...)
    -- Silent mode
end

function logger.success(...)
    -- Silent mode
end

function logger.setLogLevel(level)
    -- Silent mode
end

return logger
