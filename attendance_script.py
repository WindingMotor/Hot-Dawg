import sys
import json
import os
from datetime import datetime, timedelta
import gspread
from oauth2client.service_account import ServiceAccountCredentials
import io
import zipfile
from collections import defaultdict
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

DOCUMENTS_DIR = os.path.join(os.path.expanduser('~'), 'Documents')
CREDENTIALS_FILE = os.path.join(DOCUMENTS_DIR, 'junkyard-google-cloud-credentials.json')
SHEET_NAME = 'junkyard-attendance-master'

def initialize_sheets():
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    creds = ServiceAccountCredentials.from_json_keyfile_name(CREDENTIALS_FILE, scope)
    client = gspread.authorize(creds)
    
    try:
        sheet = client.open(SHEET_NAME).sheet1
    except gspread.SpreadsheetNotFound:
        spreadsheet = client.create(SHEET_NAME)
        sheet = spreadsheet.sheet1
        spreadsheet.share(None, perm_type='anyone', role='reader')
        sheet.append_row(['Name', 'Timestamp', 'Duration'])
    
    return sheet

def log_attendance(name):
    now = datetime.now()
    four_pm = now.replace(hour=16, minute=0, second=0, microsecond=0)
    
    if name not in ['TestUser 1', 'TestUser 2'] and now < four_pm:
        return json.dumps({"error": "Attendance can only be logged after 4:00 PM"})

    duration = 240 if name in ['TestUser 1', 'TestUser 2'] else int((now - four_pm).total_seconds() / 60)
    formatted_duration = f"{duration // 60}h {duration % 60}m"

    try:
        sheet = initialize_sheets()
        sheet.append_row([name, now.isoformat(), formatted_duration])

        return json.dumps({
            "duration": formatted_duration,
            "date": now.strftime("%Y-%m-%d")
        })
    except Exception as e:
        return json.dumps({"error": f"An error occurred while logging attendance: {str(e)}"})

def get_attendance(name):
    sheet = initialize_sheets()
    data = sheet.get_all_values()
    total_minutes = 0
    for row in data[1:]:  # Skip header row
        if row[0] == name:
            hours, minutes = row[2].split('h ')
            total_minutes += int(hours) * 60 + int(minutes[:-1])

    if total_minutes == 0:
        return json.dumps({"attendance": "No attendance records found for this name."})

    hours = total_minutes // 60
    minutes = total_minutes % 60
    return json.dumps({"attendance": f"Total attendance: {hours}h {minutes}m"})

def get_stats():
    sheet = initialize_sheets()
    data = sheet.get_all_values()
    stats = {}
    try:
        for row in data[1:]:  # Skip header row
            name = row[0]
            duration_str = row[2]
            try:
                if 'h' in duration_str and 'm' in duration_str:
                    hours, minutes = duration_str.split('h ')
                    minutes = minutes.rstrip('m')
                    duration = int(hours) * 60 + int(minutes)
                elif 'h' in duration_str:
                    hours = duration_str.rstrip('h')
                    duration = int(hours) * 60
                elif 'm' in duration_str:
                    minutes = duration_str.rstrip('m')
                    duration = int(minutes)
                else:
                    duration = 0
                
                stats[name] = stats.get(name, 0) + duration
            except ValueError:
                print(f"Warning: Invalid duration format for {name}: {duration_str}")

        for name in stats:
            hours = stats[name] // 60
            minutes = stats[name] % 60
            stats[name] = f"{hours}h {minutes}m"

        if not stats:
            return json.dumps({"stats": "No attendance data available."})
        
        return json.dumps({"stats": stats})
    except Exception as e:
        return json.dumps({"error": f"An error occurred while processing attendance data: {str(e)}"})

def get_public_link():
    sheet = initialize_sheets()
    return json.dumps({"link": sheet.url})

def clear_sheet():
    sheet = initialize_sheets()
    sheet.clear()
    sheet.update(values=[['Name', 'Timestamp', 'Duration']], range_name='A1:C1')
    
    return json.dumps({
        "status": "cleared",
        "message": "All data has been cleared from the spreadsheet."
    })

def get_top_stats():
    sheet = initialize_sheets()
    data = sheet.get_all_values()[1:]  # Skip header
    
    total_hours = defaultdict(int)
    visit_count = defaultdict(int)
    consecutive_days = defaultdict(int)
    
    last_date = {}
    current_streak = defaultdict(int)
    
    for row in data:
        name, timestamp, duration = row
        date = datetime.fromisoformat(timestamp).date()
        hours, minutes = map(int, duration.replace('h', '').replace('m', '').split())
        total_minutes = hours * 60 + minutes
        
        total_hours[name] += total_minutes
        visit_count[name] += 1
        
        if name in last_date:
            if (date - last_date[name]) == timedelta(days=1):
                current_streak[name] += 1
            else:
                consecutive_days[name] = max(consecutive_days[name], current_streak[name])
                current_streak[name] = 1
        else:
            current_streak[name] = 1
        
        last_date[name] = date
    
    # Update consecutive days with any ongoing streaks
    for name, streak in current_streak.items():
        consecutive_days[name] = max(consecutive_days[name], streak)
    
    top_hours = max(total_hours, key=total_hours.get)
    top_visits = max(visit_count, key=visit_count.get)
    top_consecutive = max(consecutive_days, key=consecutive_days.get)
    
    return json.dumps({
        "top_hours": {
            "name": top_hours,
            "hours": f"{total_hours[top_hours] // 60}h {total_hours[top_hours] % 60}m"
        },
        "top_visits": {
            "name": top_visits,
            "visits": visit_count[top_visits]
        },
        "top_consecutive": {
            "name": top_consecutive,
            "days": consecutive_days[top_consecutive]
        }
    })

def check_name(name):
    sheet = initialize_sheets()
    data = sheet.get_all_values()
    names = [row[0] for row in data[1:]]  # Assuming names are in the first column
    return json.dumps({"exists": name in names})

if __name__ == "__main__":
    command = sys.argv[1]
    
    if command == 'log' or command == 'logMe':
        print(log_attendance(sys.argv[2]))
    elif command == 'attendance':
        print(get_attendance(sys.argv[2]))
    elif command == 'stats':
        print(get_stats())
    elif command == 'getlink':
        print(get_public_link())
    elif command == 'clear':
        print(clear_sheet())
    elif command == 'check':
        print(check_name(sys.argv[2]))
    elif command == 'top':
        print(get_top_stats())
    else:
        print(json.dumps({"error": "Invalid command"}))