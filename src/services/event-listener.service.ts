import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { logger } from '../utils/logger';
import { PACKAGE_ID, MODULE_NAME } from './attestOrCreateProof.service';
import { recordWithdrawalEvent } from './withdrawal.service';
import mongoose from 'mongoose';

// Schema for cursor state
const cursorStateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  cursor: { type: String, default: null },
  lastUpdated: { type: Date, default: Date.now }
});

// Model for cursor state 
const CursorState = mongoose.model('CursorState', cursorStateSchema);

// Keep track of processed event IDs to avoid duplicates
const processedEvents = new Set<string>();

// Maximum number of failed attempts before backing off
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Setup a continuous listener for Sui events
 * This will keep running in the background and process events as they arrive
 */
export const setupContinuousEventListener = async () => {
  logger.info('Setting up continuous Sui event listener');
  
  try {
    // Clear the stored cursor if requested by configuration
    // This would typically be used during system resets or migrations
    if (process.env.RESET_EVENT_CURSOR === 'true') {
      logger.warn('Resetting event cursor as requested by configuration');
      await CursorState.deleteOne({ name: 'withdrawalEvents' });
    }
    
    // Initialize Sui client
    const client = new SuiClient({ url: getFullnodeUrl("testnet") });
    
    // Start the listener loop
    startListenerLoop(client);
    
    // Setup health check for the event listener
    // This could be expanded to send alerts if the listener stops working
    setInterval(async () => {
      try {
        const cursorState = await CursorState.findOne({ name: 'withdrawalEvents' });
        if (cursorState) {
          const lastUpdated = new Date(cursorState.lastUpdated);
          const now = new Date();
          const timeDiff = now.getTime() - lastUpdated.getTime();
          
          // If cursor hasn't been updated in more than 5 minutes, log a warning
          if (timeDiff > 5 * 60 * 1000) {
            logger.warn(`Event listener cursor hasn't been updated in ${Math.floor(timeDiff/60000)} minutes`);
          }
        }
      } catch (error: any) {
        logger.error(`Error in event listener health check: ${error.message}`);
      }
    }, 300000); // Check every 5 minutes
    
    logger.info('Sui event listener and health check setup complete');
  } catch (error: any) {
    logger.error(`Error setting up continuous event listener: ${error.message}`);
    
    // Retry setup after a delay
    setTimeout(() => setupContinuousEventListener(), 30000);
  }
};

/**
 * Continuous loop to listen for events
 * @param client The Sui client
 */
const startListenerLoop = async (client: SuiClient) => {
  try {
    // Set initial poll interval
    const baseIntervalMs = 5000; // 5 seconds
    let currentIntervalMs = baseIntervalMs;
    let consecutiveFailures = 0;
    let consecutiveEmptyPolls = 0;
    
    // Function to check for events
    const checkForEvents = async () => {
      try {
        logger.info('Checking for new events from Sui blockchain');
        
        // Query for WithdrawRequest events
        const withdrawEvents = await fetchWithdrawEvents(client);
        
        // Process withdraw events
        if (withdrawEvents.length > 0) {
          logger.info(`Processing ${withdrawEvents.length} WithdrawRequest events`);
          consecutiveEmptyPolls = 0; // Reset empty poll counter
          
          // Process events in batches to avoid overwhelming the system
          const batchSize = 10;
          for (let i = 0; i < withdrawEvents.length; i += batchSize) {
            const batch = withdrawEvents.slice(i, i + batchSize);
            
            // Process each event in the batch
            await Promise.all(batch.map(async (event) => {
              try {
                await processWithdrawEvent(event);
              } catch (error: any) {
                logger.error(`Error processing withdraw event: ${error.message}`);
              }
            }));
            
            // Brief pause between batches to avoid resource contention
            if (i + batchSize < withdrawEvents.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          // On successful processing, reset to base interval and failures
          currentIntervalMs = baseIntervalMs;
          consecutiveFailures = 0;
        } else {
          // No events found
          consecutiveEmptyPolls++;
          
          // If we've had many empty polls, gradually increase the interval 
          // to reduce unnecessary API calls (up to 30 seconds max)
          if (consecutiveEmptyPolls > 10) {
            currentIntervalMs = Math.min(baseIntervalMs * 2, 30000);
          } else if (consecutiveEmptyPolls > 20) {
            currentIntervalMs = Math.min(baseIntervalMs * 4, 30000);
          } else if (consecutiveEmptyPolls > 50) {
            currentIntervalMs = 30000; // Max poll interval: 30 seconds
          }
        }
        
        // Schedule the next check with adaptive interval
        setTimeout(checkForEvents, currentIntervalMs);
      } catch (error: any) {
        logger.error(`Error in event listener loop: ${error.message}`);
        
        // Increment failure counter
        consecutiveFailures++;
        
        // Implement exponential backoff for repeated failures
        if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
          // Calculate backoff time (capped at 2 minutes)
          const backoffMs = Math.min(baseIntervalMs * Math.pow(2, consecutiveFailures - MAX_CONSECUTIVE_FAILURES), 120000);
          logger.warn(`Too many consecutive failures (${consecutiveFailures}), backing off for ${backoffMs/1000} seconds`);
          setTimeout(checkForEvents, backoffMs);
        } else {
          // On error but under threshold, wait slightly longer than normal
          setTimeout(checkForEvents, currentIntervalMs * 2);
        }
      }
    };
    
    // Start the loop
    checkForEvents();
    
    // Periodically clean up the processed events set to prevent memory leaks
    setInterval(() => {
      if (processedEvents.size > 5000) {
        const eventsArray = Array.from(processedEvents);
        const eventsToKeep = eventsArray.slice(eventsArray.length - 1000);
        processedEvents.clear();
        eventsToKeep.forEach(event => processedEvents.add(event));
        logger.info(`Cleaned up processed events cache, kept ${eventsToKeep.length} recent events`);
      }
    }, 3600000); // Run cleanup hourly
    
  } catch (error: any) {
    logger.error(`Error starting event listener: ${error.message}`);
    
    // Restart the listener after a delay
    setTimeout(() => startListenerLoop(client), 30000);
  }
};

/**
 * Get the stored cursor for pagination
 * @returns The stored cursor or null if not found
 */
const getStoredCursor = async (): Promise<string | null> => {
  try {
    // Find existing cursor state or create new one
    const cursorState = await CursorState.findOne({ name: 'withdrawalEvents' });
    return cursorState?.cursor || null;
  } catch (error: any) {
    logger.error(`Error getting stored cursor: ${error.message}`);
    return null;
  }
};

/**
 * Save the cursor to the database for persistence
 * @param cursor The cursor to save
 */
const saveCursor = async (cursor: string): Promise<void> => {
  try {
    await CursorState.findOneAndUpdate(
      { name: 'withdrawalEvents' },
      { cursor, lastUpdated: new Date() },
      { upsert: true, new: true }
    );
  } catch (error: any) {
    logger.error(`Error saving cursor: ${error.message}`);
  }
};

/**
 * Fetch withdraw events from Sui blockchain
 * @param client The Sui client
 * @returns Array of withdraw events
 */
const fetchWithdrawEvents = async (client: SuiClient): Promise<any[]> => {
  try {
    // Get cursor from database for resilience across restarts
    const storedCursor = await getStoredCursor();
    
    // Query parameters
    const queryParams: any = {
      query: {
        MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::WithdrawRequest`
      },
      limit: 50
    };
    
    // Add cursor for pagination if available
    if (storedCursor) {
      queryParams.cursor = storedCursor;
      logger.info(`Using stored cursor: ${storedCursor.substring(0, 20)}...`);
    }
    
    // Query for events
    const events = await client.queryEvents(queryParams);
    
    // Update cursor for next query
    if (events.hasNextPage && events.nextCursor) {
      await saveCursor(events.nextCursor);
      logger.info(`Updated cursor: ${events.nextCursor.substring(0, 20)}...`);
    }
    
    logger.info(`Found ${events.data.length} WithdrawRequest events`);
    
    // Filter out already processed events to ensure idempotency
    const newEvents = events.data.filter(event => !processedEvents.has(event.id));
    if (newEvents.length < events.data.length) {
      logger.info(`Filtered out ${events.data.length - newEvents.length} already processed events`);
    }
    
    // Add new events to the processed set
    newEvents.forEach(event => processedEvents.add(event.id));
    
    // Limit the size of processed events set to avoid memory leaks
    if (processedEvents.size > 10000) {
      // If we have too many events, clear the older ones
      const eventsArray = Array.from(processedEvents);
      const eventsToKeep = eventsArray.slice(eventsArray.length - 1000);
      processedEvents.clear();
      eventsToKeep.forEach(event => processedEvents.add(event));
    }
    
    return newEvents;
  } catch (error: any) {
    logger.error(`Error fetching withdraw events: ${error.message}`);
    return [];
  }
};

/**
 * Validate Bitcoin address format
 * @param address Bitcoin address to validate
 * @returns Whether the address appears valid
 */
const validateBitcoinAddress = (address: string): boolean => {
  // Basic Bitcoin address validation
  // In production, use a Bitcoin-specific library for rigorous validation
  
  // Check length (26-35 characters typical for Bitcoin addresses)
  if (address.length < 26 || address.length > 35) return false;
  
  // Must start with 1, 3, or bc1
  if (!address.startsWith('1') && !address.startsWith('3') && !address.startsWith('bc1')) {
    return false;
  }
  
  // Basic character set validation
  const validChars = /^[a-zA-Z0-9]+$/;
  return validChars.test(address);
};

/**
 * Process a withdraw event
 * @param event The withdraw event
 */
const processWithdrawEvent = async (event: any) => {
  try {
    logger.info(`Processing withdraw event: ${event.id}`);
    
    // Extract event data
    const eventData = event.parsedJson;
    
    if (!eventData) {
      logger.error(`Event ${event.id} has no parsedJson data`);
      return;
    }
    
    // Validate required fields
    if (!eventData.user || !eventData.btc_address || eventData.amount === undefined) {
      logger.error(`Event ${event.id} is missing required fields`);
      return;
    }
    
    // Convert Bitcoin address from bytes format if needed
    let bitcoinAddress = eventData.btc_address;
    if (Buffer.isBuffer(bitcoinAddress) || Array.isArray(bitcoinAddress)) {
      bitcoinAddress = Buffer.from(bitcoinAddress).toString();
    }
    
    // Validate Bitcoin address format
    if (!validateBitcoinAddress(bitcoinAddress)) {
      logger.error(`Invalid Bitcoin address format in event ${event.id}: ${bitcoinAddress}`);
      return;
    }
    
    // Validate amount is reasonable
    const amount = Number(eventData.amount);
    if (isNaN(amount) || amount <= 0) {
      logger.error(`Invalid withdrawal amount in event ${event.id}: ${eventData.amount}`);
      return;
    }
    
    // Check for reasonable amount limits (example: 10 BTC max)
    const MAX_WITHDRAWAL_AMOUNT = 10 * 100000000; // 10 BTC in satoshis
    if (amount > MAX_WITHDRAWAL_AMOUNT) {
      logger.error(`Withdrawal amount exceeds maximum allowed in event ${event.id}: ${amount}`);
      return;
    }
    
    // Record and process the withdrawal event
    await recordWithdrawalEvent(
      eventData.user,
      bitcoinAddress,
      amount,
      event.id
    );
    
    logger.info(`Successfully processed withdraw event: ${event.id}`);
  } catch (error: any) {
    logger.error(`Error processing withdraw event ${event.id}: ${error.message}`);
    
    // Don't rethrow to prevent stopping the event processor
    // The error is logged and we'll continue processing other events
  }
};