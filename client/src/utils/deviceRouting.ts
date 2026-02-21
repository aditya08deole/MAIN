/**
 * Device routing utility
 * Maps devices to their correct analytics pages based on device_type or analytics_template
 */

export interface Device {
  id: string;
  device_type?: string;
  analytics_template?: string;
  asset_type?: string;
}

/**
 * Get the analytics page route for a device
 * Priority: analytics_template > device_type > asset_type > default
 */
export function getDeviceAnalyticsRoute(device: Device): string {
  // Use analytics_template if available (most explicit)
  if (device.analytics_template) {
    switch (device.analytics_template.toLowerCase()) {
      case 'evaratank':
        return `/evaratank/${device.id}`;
      case 'evaradeep':
        return `/evaradeep/${device.id}`;
      case 'evaraflow':
        return `/evaraflow/${device.id}`;
    }
  }

  // Fall back to device_type
  if (device.device_type) {
    switch (device.device_type.toLowerCase()) {
      case 'tank':
      case 'sump':
        return `/evaratank/${device.id}`;
      case 'deep':
      case 'bore':
      case 'borewell':
        return `/evaradeep/${device.id}`;
      case 'flow':
      case 'pump':
        return `/evaraflow/${device.id}`;
    }
  }

  // Fall back to asset_type (legacy)
  if (device.asset_type) {
    switch (device.asset_type.toLowerCase()) {
      case 'tank':
      case 'sump':
        return `/evaratank/${device.id}`;
      case 'bore':
      case 'govt':
        return `/evaradeep/${device.id}`;
      case 'pump':
        return `/evaraflow/${device.id}`;
    }
  }

  // Default fallback to node details page
  return `/node/${device.id}`;
}

/**
 * Get display label for device type
 */
export function getDeviceTypeLabel(device: Device): string {
  if (device.analytics_template) {
    return device.analytics_template;
  }
  if (device.device_type) {
    return device.device_type.charAt(0).toUpperCase() + device.device_type.slice(1);
  }
  if (device.asset_type) {
    return device.asset_type.charAt(0).toUpperCase() + device.asset_type.slice(1);
  }
  return 'Device';
}
