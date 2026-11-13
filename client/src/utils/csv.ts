import type {
    Checkin,
    Net
} from '../api';

/**
 * Escapes a CSV field value to handle special characters
 * - Wraps fields containing commas, quotes, or newlines in double quotes
 * - Escapes existing double quotes by doubling them
 */
function escapeCsvField(value: string | null | undefined): string {
    if (value === null || value === undefined) {
        return '';
    }

    // Check if the field needs to be quoted
    const needsQuoting = value.includes(',')
        || value.includes('"')
        || value.includes('\n')
        || value.includes('\r');

    if (needsQuoting) {
        // Escape existing quotes by doubling them
        const escaped = value.replace(/"/g, '""');
        return `"${escaped}"`;
    }

    return value;
}

/**
 * Formats a timestamp for CSV export
 * Converts ISO timestamp to a readable format: YYYY-MM-DD HH:MM:SS
 */
function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);

    // Format as YYYY-MM-DD HH:MM:SS
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Formats mobility type for CSV export
 */
function formatMobility(mobility: string): string {
    if (mobility === 'neither') {
        return 'Fixed';
    }
    // Capitalize first letter
    return mobility.charAt(0).toUpperCase() + mobility.slice(1);
}

/**
 * Generates a filename for the CSV export based on the net start date
 */
function generateFilename(netInfo: Net): string {
    const reference = netInfo.started_at ?? netInfo.created_at;
    const date = new Date(reference);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `net-${year}-${month}-${day}.csv`;
}

/**
 * Exports checkins to CSV format and triggers browser download
 *
 * @param checkins - Array of checkin records to export
 * @param netInfo - Net information for filename generation
 */
export function exportCheckinsToCSV(checkins: Checkin[], netInfo: Net): void {
    // Define CSV headers
    const headers = [
        'Time',
        'Callsign',
        'Name',
        'Mobility',
        'Staying',
        'Topic Answer',
        'Called Back',
        'Notes'
    ];

    // Build CSV rows
    const rows = checkins.map((checkin) => {
        return [
            escapeCsvField(formatTimestamp(checkin.time_entered)),
            escapeCsvField(checkin.callsign),
            escapeCsvField(checkin.display_name),
            escapeCsvField(formatMobility(checkin.mobility)),
            escapeCsvField(checkin.staying ? 'Yes' : 'No'),
            escapeCsvField(checkin.topic_answer),
            escapeCsvField(checkin.called_back ? 'Yes' : 'No'),
            escapeCsvField(checkin.operator_notes)
        ].join(',');
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows].join('\n');

    // Create a Blob with the CSV content
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // Create a download link and trigger the download
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', generateFilename(netInfo));
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL object
    URL.revokeObjectURL(url);
}