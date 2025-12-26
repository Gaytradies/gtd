// Calendar and availability utilities

type WorkCalendar = Record<string, string[] | Record<string, unknown>>;

// Get current time slot based on hour
export const getCurrentTimeSlot = () => {
  const currentHour = new Date().getHours();
  
  if (currentHour >= 8 && currentHour < 12) {
    return 'morning';
  } else if (currentHour >= 12 && currentHour < 20) {
    return 'afternoon';
  } else if (currentHour >= 20 && currentHour < 23) {
    return 'evening';
  }
  
  return null;
};

// Format date as YYYY-MM-DD
export const formatDateKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// Get next available date and time for a tradie based on their work calendar
export const getNextAvailableDateTime = (workCalendar: WorkCalendar) => {
  if (!workCalendar || Object.keys(workCalendar).length === 0) {
    return null; // No unavailability set
  }
  
  const now = new Date();
  const todayDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Check the next 365 days to find first available slot
  for (let daysAhead = 0; daysAhead < 365; daysAhead++) {
    const checkDate = new Date(todayDateOnly);
    checkDate.setDate(todayDateOnly.getDate() + daysAhead);
    const dateKey = formatDateKey(checkDate);
    
    const dateSlots = workCalendar[dateKey];
    
    // Check each time slot for this date
    const timeSlots = ['morning', 'afternoon', 'evening'];
    for (const slot of timeSlots) {
      let isUnavailable = false;
      
      // Support both old format (array) and new format (object)
      if (dateSlots) {
        if (Array.isArray(dateSlots)) {
          isUnavailable = dateSlots.includes(slot);
        } else {
          isUnavailable = !!dateSlots[slot];
        }
      }
      
      if (!isUnavailable) {
        // Found an available slot!
        // If it's today, make sure the time slot hasn't passed
        if (daysAhead === 0) {
          const currentTimeSlot = getCurrentTimeSlot();
          const slotOrder: Record<'morning' | 'afternoon' | 'evening', number> = { morning: 0, afternoon: 1, evening: 2 };
          
          // If current slot is null (before 8am or after 11pm), next availability is morning
          if (currentTimeSlot === null) {
            if (slot === 'morning') {
              return { date: checkDate, timeSlot: slot, dateKey };
            }
            continue; // Skip slots before morning
          }
          
          // Only consider future slots today
          const slotKey = slot as keyof typeof slotOrder;
          if (slotOrder[slotKey] <= slotOrder[currentTimeSlot]) {
            continue;
          }
        }
        
        return { date: checkDate, timeSlot: slot, dateKey };
      }
    }
  }
  
  // If we've checked 365 days and found nothing, they're unavailable indefinitely
  return null;
};

// Check if tradie is CURRENTLY unavailable (right now)
export const isCurrentlyUnavailable = (workCalendar: WorkCalendar): boolean => {
  if (!workCalendar || Object.keys(workCalendar).length === 0) {
    return false; // No unavailability set, so available
  }
  
  const now = new Date();
  const currentDateKey = formatDateKey(now);
  const currentTimeSlot = getCurrentTimeSlot();
  
  // If no current time slot (before 8am or after 11pm), consider available
  if (!currentTimeSlot) {
    return false;
  }
  
  const dateSlots = workCalendar[currentDateKey];
  if (!dateSlots) return false;
  
  // Support both old format (array) and new format (object)
  if (Array.isArray(dateSlots)) {
    return dateSlots.includes(currentTimeSlot);
  } else {
    return !!dateSlots[currentTimeSlot];
  }
};

// Get unavailability info for current time (reason and jobId if applicable)
export const getCurrentUnavailabilityInfo = (workCalendar: WorkCalendar) => {
  if (!workCalendar || Object.keys(workCalendar).length === 0) {
    return null;
  }
  
  const now = new Date();
  const currentDateKey = formatDateKey(now);
  const currentTimeSlot = getCurrentTimeSlot();
  
  if (!currentTimeSlot) {
    return null;
  }
  
  const dateSlots = workCalendar[currentDateKey];
  if (!dateSlots) return null;
  
  // Support both old format (array) and new format (object)
  if (Array.isArray(dateSlots)) {
    return dateSlots.includes(currentTimeSlot) ? { reason: 'manual' } : null;
  } else {
    return dateSlots[currentTimeSlot] || null;
  }
};

// Format time slot for display
export const formatTimeSlot = (timeSlot: string): string => {
  const timeSlotMap: Record<string, string> = {
    morning: '8:00 AM',
    afternoon: '12:00 PM',
    evening: '8:00 PM'
  };
  return timeSlotMap[timeSlot] || '';
};
