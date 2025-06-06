import sys
import os
import pythoncom
import subprocess
import time
import shutil
import zipfile
import email
import re
import threading
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from PIL import Image
import keyboard

# Third-party imports
import flet as ft
import win32gui
import win32process
import win32con
import win32com.client
import psutil
import ctypes
from PIL import ImageGrab
import PyPDF2
import fitz
from PyPDF2 import PdfReader, PdfWriter
import ctypes
from ctypes import wintypes
import win32api
import pystray

from office import (
    createTemplate,
    remove_underscores,
    extractZip,
    compile,
    dlAttachments,
    drafts,
    moveDL,
    extractPdf,
    carryDailies,
    moveSC,
    merge_pdfs,
    merge_text_files,
    appendText,
    copyFile,
    finals,
    renameFile,
    copyINC,
    pdfText,
    mergeINC,
    checkSubs,
    copy_fees_summary,  # Add these new functions
    open_scripts_folder,  # Add these new functions
    ftransfer,
    accy
)
# Define PowerToys-inspired color theme
class Theme:
    # Main colors
    BG_DARK = "#1e1e1e"
    BG_MEDIUM = "#252526"
    BG_LIGHT = "#2d2d30"
    
    # Text colors
    TEXT_PRIMARY = "#ffffff"
    TEXT_SECONDARY = "#cccccc"
    TEXT_HINT = "#8a8a8a"
    TEXT_DISABLED = "#6d6d6d"
    
    # Accent colors
    ACCENT = "#0078d7"
    ACCENT_HOVER = "#1a86d9"
    SUCCESS = "#4caf50"
    WARNING = "#ff9800"
    ERROR = "#f44336"
    
    # Border colors
    BORDER_DARK = "#121212"
    BORDER_LIGHT = "#3f3f3f"
    
    # Transparency values
    OVERLAY_OPACITY = 0.9
    
    # Sizes and spacing
    BORDER_RADIUS = 8
    PADDING_SMALL = 8
    PADDING_MEDIUM = 12
    PADDING_LARGE = 16
    
    # Font sizes
    FONT_SMALL = 12
    FONT_MEDIUM = 14
    FONT_LARGE = 16
    
    # Animations
    ANIMATION_DURATION = 150
    
    @classmethod
    def get_command_icon(cls, command_name: str) -> str:
        """Return an appropriate icon for a given command."""
        # Map command categories to icons
        icon_map = {
            # Templates and documents
            "wp": ft.icons.DESCRIPTION,
            "IR3": ft.icons.RECEIPT_LONG,
            "GST": ft.icons.RECEIPT,
            "int": ft.icons.CALCULATE,
            "time": ft.icons.TIMER,
            "acc": ft.icons.ACCOUNT_BALANCE,
            "checklist": ft.icons.CHECKLIST,
            "div": ft.icons.PIE_CHART,
            
            # File operations
            "removeud": ft.icons.TEXT_FORMAT,
            "extract": ft.icons.FOLDER_ZIP,
            "compile": ft.icons.FOLDER,
            "emlAtt": ft.icons.ATTACHMENT,
            "drafts": ft.icons.EDIT_NOTE,
            "transfer": ft.icons.DOWNLOAD,
            "ren": ft.icons.DRIVE_FILE_RENAME_OUTLINE,
            "append": ft.icons.ADD,
            "copyFile": ft.icons.COPY_ALL,
            "accy": ft.icons.CALCULATE_OUTLINED,
            
            # PDF operations
            "extractPdf": ft.icons.PICTURE_AS_PDF,
            "merge": ft.icons.MERGE_TYPE,
            "pdfText": ft.icons.TEXT_SNIPPET,
            "pdfinc": ft.icons.MERGE,
            "feesx": ft.icons.CONTENT_COPY,
            "scripts": ft.icons.CODE,
            "ftransfer": ft.icons.DRIVE_FOLDER_UPLOAD,
            
            # Screenshots and images
            "sc": ft.icons.SCREENSHOT_MONITOR,
            "dep": ft.icons.IMAGE,
            "feeds": ft.icons.FEED,
            "lfeeds": ft.icons.RSS_FEED,
            
            # Financial data
            "far": ft.icons.INVENTORY,
            "depn": ft.icons.TRENDING_DOWN,
            "disposal": ft.icons.DELETE_FOREVER,
            "gstr": ft.icons.SUMMARIZE,
            "gstt": ft.icons.LIST_ALT,
            "payer": ft.icons.PAYMENTS,
            "payet": ft.icons.RECEIPT_LONG,
            "ap": ft.icons.ACCOUNT_BALANCE,
            "ar": ft.icons.ACCOUNT_BALANCE_WALLET,
            "fees": ft.icons.ATTACH_MONEY,
            "curr": ft.icons.CURRENCY_EXCHANGE,
            "ent": ft.icons.EVENT_AVAILABLE,
            "acct": ft.icons.ACCOUNT_BALANCE,
            "gstrec": ft.icons.SYNC_ALT,
            "inc": ft.icons.ADD_CHART,
            "gl": ft.icons.BOOK,
            
            # Misc
            "dailies": ft.icons.TODAY,
            "mergeTxt": ft.icons.MERGE,
            "xc": ft.icons.CHECK_CIRCLE,
            "acct": ft.icons.ACCESS_TIME,
            "depv": ft.icons.DIRECTIONS_CAR,
            "finals": ft.icons.DONE_ALL,
            "lc": ft.icons.VERIFIED,
            "subs": ft.icons.SUBDIRECTORY_ARROW_RIGHT,
        }
        
        # Return the mapped icon or a default icon
        return icon_map.get(command_name, ft.icons.TERMINAL)

# Define the FUNCTION_MAP with argument templates
FUNCTION_MAP = {
    "wp":        (createTemplate, [r"C:\\Users\\EdwardMatias\\Documents\\Work Resources\\2022 Year - Workpapers\\2022 Workpapers.xlsm"]),
    "IR3":       (createTemplate, [r"C:\\Users\\EdwardMatias\\Documents\\Templates\\IR 3 - Client Name - FY - Excel Workings.xlsx"]),
    "GST":       (createTemplate, [r"C:\\Users\\EdwardMatias\\Documents\\Contractor Workpapers - CLIENT NAME - FY24.xlsm"]),
    "int":       (createTemplate, [r"C:\\Users\\EdwardMatias\\Documents\\Templates\\Interest Deductibility Calculations.xlsm"]),
    "removeud":  (remove_underscores, []),
    "extract":   (extractZip, []),
    "compile":   (compile, []),
    "emlAtt":    (dlAttachments, []),
    "drafts":    (drafts, []),
    "transfer":  (moveDL, []),
    "time":      (createTemplate, [r"C:\\Users\\EdwardMatias\\Documents\\Templates\\Time Budget - Client Name - FY23 - V1.2.xlsm"]),
    "extractPdf":(extractPdf, []),
    "far":       (moveDL, ["F - Fixed Assets Reconciliation"]),
    "depn":      (moveDL, ["F - Depreciation Schedule"]),
    "disposal":  (moveDL, ["F - Disposal Schedule"]),
    "gstr":      (moveDL, ["K - GST Return Summary"]),
    "gstt":      (moveDL, ["K - GST Transactions"]),
    "payer":     (moveDL, ["W - PAYE Return Summary"]),
    "payet":     (moveDL, ["W - PAYE Transactions"]),
    "ap":        (moveDL, ["G - AP Summary"]),
    "ar":        (moveDL, ["D - AR Summary"]),
    "fees":      (moveDL, ["Q - Outside - Fees Summary"]),
    "curr":      (moveDL, ["N - Current Account Transactions"]),
    "ent":       (moveDL, ["R - Entertainment Transactions"]),
    "acc":       (createTemplate, [r"C:\\Users\\EdwardMatias\\Documents\\Templates\\ACC Workpaper - Company or Trust.xlsx"]),
    "dailies":   (carryDailies, []),
    "sc":        (moveSC, None),  # Takes arguments dynamically
    "dep":       (moveSC, "F - FA-{0} Dep Rate"),  # Template with placeholder {0}
    "fa":        (moveDL, "F - FA-{0} Invoice"),   # Template with placeholder {0}
    "merge":     (merge_pdfs, ["{0}"]),
    "mergeTxt":  (merge_text_files, []),
    "append":    (appendText, []),
    "xc":        (moveDL, ["C - Xero Confirm - {0}"]),  # Template with placeholder {0}
    "acct":      (moveDL, ["Q - ACC Timeline"]),
    "feeds":     (moveSC, "C - Bank Feeds Activated - {0}"),  # Template with placeholder {0}
    "depv":      (copyFile, ["Vehicle Dep Rate.png", "F - FA-{1} Dep Rate.png"]),  # Template with placeholders
    "finals":    (finals, []),
    "ren":       (renameFile, []),
    "checklist": (createTemplate, [r"C:\\Users\\EdwardMatias\\Documents\\AA - Accounts Checklist.xlsx"]),
    "gstrec":    (moveDL, ["K - GST Reconciliation Report"]),
    "inc":       (copyINC, []),
    "pdfText":   (pdfText, []),
    "lfeeds":    (moveSC, "I - Bank Feeds Activated - {0}"),  # Template with placeholder {0}
    "lc":        (moveDL, "I - Xero Confirm - {0}"),  # Template with placeholder {0}
    "pdfinc":    (mergeINC, []),
    "div":       (createTemplate, [r"C:\\Users\\EdwardMatias\\Documents\\Templates\\Dividend Workpapers and Minutes.xlsx"]),
    "gl":        (moveDL, ["Q - GL Detail - Profit & Loss"]),
    "subs":      (checkSubs, []),
    "feesx":    (copy_fees_summary, []),
    "scripts":  (open_scripts_folder, []),
    "finals":   (finals, []),
    "ftransfer": (ftransfer, []),
    "accy": (accy, []),
}

# Add command descriptions for better user experience
COMMAND_DESCRIPTIONS = {
    "wp": "Open workpapers template",
    "IR3": "Create IR3 tax return template",
    "GST": "Open GST workpapers template",
    "int": "Open interest deductibility calculator",
    "removeud": "Remove underscores from filenames",
    "extract": "Extract all zip files in current directory",
    "compile": "Move all files from subdirectories to current directory",
    "emlAtt": "Extract attachments from email files",
    "drafts": "Prefix files with 'DRAFT - '",
    "transfer": "Transfer file(s) from Downloads folder",
    "time": "Open time budget template",
    "extractPdf": "Extract pages from PDF file",
    "far": "Transfer Fixed Assets Reconciliation from Downloads",
    "depn": "Transfer Depreciation Schedule from Downloads",
    "disposal": "Transfer Disposal Schedule from Downloads",
    "gstr": "Transfer GST Return Summary from Downloads",
    "gstt": "Transfer GST Transactions from Downloads",
    "payer": "Transfer PAYE Return Summary from Downloads",
    "payet": "Transfer PAYE Transactions from Downloads",
    "ap": "Transfer Accounts Payable Summary from Downloads",
    "ar": "Transfer Accounts Receivable Summary from Downloads",
    "fees": "Transfer Fees Summary from Downloads",
    "curr": "Transfer Current Account Transactions from Downloads",
    "ent": "Transfer Entertainment Transactions from Downloads",
    "acc": "Open ACC Workpaper template",
    "dailies": "Carry over unfinished tasks from previous daily note",
    "sc": "Move most recent screenshot to current directory",
    "dep": "Move screenshot as depreciation rate image",
    "fa": "Transfer fixed asset invoice from Downloads",
    "merge": "Merge PDF files in current directory",
    "mergeTxt": "Merge text files in current directory",
    "append": "Append text to filenames",
    "xc": "Transfer Xero confirmation from Downloads",
    "acct": "Transfer ACC Timeline from Downloads",
    "feeds": "Move screenshot as bank feeds activation image",
    "depv": "Copy vehicle depreciation rate image",
    "ren": "Rename most recent file in directory",
    "checklist": "Open accounts checklist template",
    "gstrec": "Transfer GST Reconciliation Report from Downloads",
    "inc": "Copy IRD files with A- prefix",
    "pdfText": "Extract text from PDF files",
    "lfeeds": "Move screenshot as bank feeds activation image (I prefix)",
    "lc": "Transfer Xero confirmation from Downloads (I prefix)",
    "pdfinc": "Merge IRD PDF files",
    "div": "Open dividend workpapers template",
    "gl": "Transfer GL Detail P&L from Downloads",
    "subs": "Check for subdirectories with multiple folders",
    "feesx": "Copy Q - Outside - Fees Summary.pdf to G - Outside - Fees Summary.pdf",
    "scripts": "Open VS Code in Scripts folder",
    "finals": "Manage and display files in Finals folder",
    "ftransfer": "Transfer files from Downloads to Finals folder",
    "accy": "Calculate total invoice amount from accounting document",
}

# Define command categories for better organization
COMMAND_CATEGORIES = {
    "Templates": ["wp", "IR3", "GST", "int", "time", "acc", "checklist", "div"],
    "PDF Tools": ["extractPdf", "merge", "pdfText", "pdfinc"],
    "Screenshots": ["sc", "dep", "feeds", "lfeeds", "depv"],
    "Downloads": ["far", "depn", "disposal", "gstr", "gstt", "payer", "payet", "ap", "ar", "fees", "curr", "ent", "acct", "gstrec", "fa", "xc", "lc", "gl"],
    "File Operations": ["removeud", "extract", "compile", "emlAtt", "drafts", "transfer", "ren", "append", "copyFile", "finals", "feesx","ftransfer"],
    "Other": ["dailies", "mergeTxt", "inc", "subs", "scripts","accy"]
}

# Define a list of frequently used file names
FREQUENT_FILE_NAMES = [
    "K - GST Late Claims",
    "O - Current Account Transactions",
    "Q - ACC Invoice",
    "S-1 - Home Office Form",
    # More can be added later
]

class AdvancedRun:
    def __init__(self):
        self.current_dir = os.getcwd()
        self.minimized_to_tray = False
        self.status_text = None
        self.dir_text = None
        self.page = None
        self.input_field = None
        self.tray_icon = None
        self.suggestions_list = None
        self.preview_container = None
        self.preview_content = None
        self.last_preview_type = None
        self.input_field_has_focus = False
        
        # Register global hotkey before starting the app
        self.register_global_hotkey()
        
        # Create system tray icon
        self.create_system_tray()
        
        # Start the app
        self.app = ft.app(target=self.main)
    
    def get_explorer_windows(self):
        """Get all File Explorer windows and their paths."""
        explorer_windows = []
        
        def callback(hwnd, _):
            if win32gui.IsWindowVisible(hwnd):
                # Check if the window is an Explorer window
                class_name = win32gui.GetClassName(hwnd)
                window_title = win32gui.GetWindowText(hwnd)
                
                # CabinetWClass is the class for Explorer windows
                if class_name == "CabinetWClass":
                    # Get window process ID to verify it's Explorer
                    _, pid = win32process.GetWindowThreadProcessId(hwnd)
                    try:
                        proc = psutil.Process(pid)
                        if proc.name().lower() == "explorer.exe":
                            # This is an Explorer window
                            # The title usually contains the path
                            explorer_windows.append((hwnd, window_title))
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass
            return True
        
        win32gui.EnumWindows(callback, None)
        return explorer_windows
    
    def is_foreground_explorer(self, hwnd):
        """Check if the given window handle is the foreground window."""
        return hwnd == win32gui.GetForegroundWindow()
        
    def extract_path_from_title(self, title):
        """Extract a valid path from an Explorer window title."""
        
        # Check if it's already a path
        if os.path.isdir(title):
            return title
            
        # Common patterns in Explorer window titles
        # Pattern: "Folder Name - File Explorer" or "Folder Name"
        folder_match = re.match(r"^(.+?)(?:\s*-\s*File Explorer)?$", title)
        if folder_match:
            folder_name = folder_match.group(1).strip()
            
            # For nested folders
            def find_folder_path(folder_name):
                # Search in common locations
                search_paths = [
                    r"C:\Users\EdwardMatias\Documents\Clients",
                    os.path.join(os.environ["USERPROFILE"], "Documents"),
                    os.path.join(os.environ["USERPROFILE"], "Desktop"),
                    os.path.join(os.environ["USERPROFILE"], "Downloads"),
                    os.path.join(os.environ["USERPROFILE"]),
                    "C:\\"
                ]
                
                for search_path in search_paths:
                    if os.path.exists(search_path):
                        try:
                            # Walk through all subdirectories
                            for root, dirs, files in os.walk(search_path):
                                if os.path.basename(root) == folder_name:
                                    return root
                        except:
                            continue
                
                return None
            
            found_path = find_folder_path(folder_name)
            if found_path:
                return found_path
        
        # If we can't determine the path, return None
        return None
        
    def get_explorer_window_path(self, hwnd):
        """Get the path of an Explorer window using Windows API."""
        try:
            # Define constants
            SHGFI_PIDL = 0x000000008
            SHGFI_DISPLAYNAME = 0x000000200
            
            # Define structures
            class SHFILEINFO(ctypes.Structure):
                _fields_ = [
                    ('hIcon', wintypes.HICON),
                    ('iIcon', ctypes.c_int),
                    ('dwAttributes', wintypes.DWORD),
                    ('szDisplayName', wintypes.WCHAR * 260),
                    ('szTypeName', wintypes.WCHAR * 80),
                ]
            
            # Get window process ID
            _, process_id = win32process.GetWindowThreadProcessId(hwnd)
            
            # Try to get the path through automation
            try:
                import win32com.client
                
                shell = win32com.client.Dispatch("Shell.Application")
                windows = shell.Windows()
                
                for i in range(windows.Count):
                    window = windows.Item(i)
                    if window and window.HWND == hwnd:
                        path = window.Document.Folder.Self.Path
                        if os.path.isdir(path):
                            return path
            except:
                pass
            
            # Alternative: try to get path from process
            try:
                proc = psutil.Process(process_id)
                
                # Get command line
                cmdline = proc.cmdline()
                for cmd in cmdline:
                    if os.path.isdir(cmd):
                        return cmd
            except:
                pass
            
            # Last resort: examine window title
            window_title = win32gui.GetWindowText(hwnd)
            path = self.extract_path_from_title(window_title)
            if path:
                return path
            
            return None
            
        except Exception as e:
            print(f"Error getting explorer path: {e}")
            return None
        
    def get_current_explorer_path(self):
        try:
            pythoncom.CoInitialize()  # Initialize COM for this thread
            shell = win32com.client.Dispatch("Shell.Application")
            windows = shell.Windows()

            if windows.Count == 0:
                raise Exception("No File Explorer windows are currently open.")

            window = windows[0]

            if window.Name != "File Explorer" and "explorer" not in window.FullName.lower():
                raise Exception("First window is not a File Explorer instance.")

            path = window.Document.Folder.Self.Path
            return path

        except Exception as e:
            return f"Error: {e}"

        finally:
            pythoncom.CoUninitialize()  # Always uninitialize

    def update_working_directory(self, page: ft.Page):
        """Update the working directory display with the current Explorer path."""
        try:
            new_dir = self.get_current_explorer_path()
            # print(new_dir)
            if new_dir != self.current_dir:
                self.current_dir = new_dir
                if self.dir_text:
                    # Update the directory indicator with path and icon
                    self.dir_text.value = os.path.basename(self.current_dir)
                    self.dir_text.tooltip = self.current_dir
                    
                    # Update the full path display
                    if hasattr(self, 'full_path_text'):
                        self.full_path_text.value = self.current_dir
                    
                    self.log(f"Working in: {os.path.basename(self.current_dir)}", 
                             self.status_text, Theme.SUCCESS)
                    page.update()
        except Exception as e:
            if self.status_text:
                self.log(f"Error updating directory: {str(e)}", self.status_text, Theme.ERROR)

    def log(self, msg, status_text, status_color=ft.colors.WHITE):
        """Log a message to the status bar with timestamp and length limit."""
        if status_text:
            timestamp = time.strftime("%H:%M:%S")
            
            # Get available width for the log message
            # This is an estimate - you might need to adjust the max_length based on your UI
            max_length = 90  # Adjust this value based on your UI layout
            
            # Truncate the message if it's too long
            if len(msg) > max_length:
                # Keep the first part and append ellipsis
                truncated_msg = msg[:max_length-3] + "..."
                
                # Set the full message as tooltip
                status_text.tooltip = f"[{timestamp}] {msg}"
                status_text.value = f"[{timestamp}] {truncated_msg}"
            else:
                status_text.tooltip = None
                status_text.value = f"[{timestamp}] {msg}"
                
            status_text.color = status_color
            status_text.update()

    def show_invoice_total_dialog(self, total_amount):
        """
        Shows a dialog with the calculated invoice total.
        """
        if not self.page:
            return
            
        # Format the total amount
        formatted_total = f"${total_amount:,.2f}"
        
        # Create the dialog
        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Text("Invoice Total"),
            content=ft.Container(
                content=ft.Column([
                    ft.Text("Total amount from all invoices:"),
                    ft.Container(height=10),
                    ft.Text(
                        formatted_total,
                        size=24,
                        weight=ft.FontWeight.BOLD,
                        color=Theme.ACCENT
                    ),
                    ft.Container(height=10),
                    ft.Text(
                        "This total is calculated from all 'Invoice #' entries in the document.",
                        size=12,
                        color=Theme.TEXT_HINT,
                        italic=True
                    )
                ]),
                padding=20,
                width=350
            ),
            actions=[
                ft.TextButton("Copy to Clipboard", on_click=lambda e: self.copy_to_clipboard(formatted_total)),
                ft.TextButton("Close", on_click=lambda e: self.page.close(dialog))
            ],
            actions_alignment=ft.MainAxisAlignment.END
        )
        
        # Show the dialog
        self.page.dialog = dialog
        dialog.open = True
        self.page.open(dialog)
        self.page.update()

    def copy_to_clipboard(self, text):
        """Copies text to clipboard and shows a notification."""
        self.page.set_clipboard(text)
        self.page.show_snack_bar(
            ft.SnackBar(
                content=ft.Text("Amount copied to clipboard"),
                action="OK",
                action_color=Theme.ACCENT,
                bgcolor=Theme.BG_LIGHT,
                duration=1500
            )
        )
        
    # Preview methods
    def show_screenshot_preview(self, page: ft.Page):
        """Show a preview of the most recent screenshot."""
        try:
            screenshots = os.path.join(os.environ["USERPROFILE"], "Pictures", "Screenshots")
            if not os.path.exists(screenshots):
                self.log("Screenshots folder not found", self.status_text, Theme.ERROR)
                return None
                
            files = sorted(os.listdir(screenshots), key=lambda x: os.path.getmtime(os.path.join(screenshots, x)), reverse=True)
            if not files:
                self.log("No screenshots found", self.status_text, Theme.WARNING)
                return None
                
            recent = files[0]
            path = os.path.join(screenshots, recent)
            
            # Return the path if it's an image
            if path.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".bmp")):
                return path
            return None
        except Exception as e:
            self.log(f"Screenshot preview error: {str(e)}", self.status_text, Theme.ERROR)
            return None
            
    def get_download_previews(self, num_files=1):
        """Get a list of the most recent files from Downloads folder."""
        try:
            downloads = os.path.join(os.environ["USERPROFILE"], "Downloads")
            if not os.path.exists(downloads):
                self.log("Downloads folder not found", self.status_text, Theme.ERROR)
                return []
                
            files = sorted(os.listdir(downloads), key=lambda x: os.path.getmtime(os.path.join(downloads, x)), reverse=True)
            if not files:
                self.log("No files found in Downloads folder", self.status_text, Theme.WARNING)
                return []
            
            # Handle case where num_files is a string (filename)
            if isinstance(num_files, str):
                # Just return the first file with the new name
                if files:
                    return [(num_files, os.path.join(downloads, files[0]))]
                return []
                
            # Return the requested number of files (or all if fewer exist)
            return [(f, os.path.join(downloads, f)) for f in files[:min(num_files, len(files))]]
        except Exception as e:
            self.log(f"Download preview error: {str(e)}", self.status_text, Theme.ERROR)
    
    def create_preview_content(self, preview_type, preview_data):
        """Create preview content based on type and data."""
        if preview_type == "screenshot":
            # Create screenshot preview
            screenshot_path = preview_data
            if screenshot_path:
                return ft.Column(
                    controls=[
                        ft.Row([
                            ft.Icon(name=ft.icons.IMAGE, size=16, color=Theme.TEXT_HINT),
                            ft.Text("Screenshot Preview", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                        ], spacing=8),
                        ft.Container(
                            content=ft.Image(
                                src=screenshot_path,
                                fit=ft.ImageFit.CONTAIN,
                                border_radius=Theme.BORDER_RADIUS,
                            ),
                            border_radius=Theme.BORDER_RADIUS,
                            bgcolor=Theme.BG_MEDIUM,
                            padding=4,
                            margin=ft.margin.only(top=8),
                            alignment=ft.alignment.center,
                            width=480,
                            height=240
                        )
                    ],
                    spacing=8
                )
            else:
                return ft.Column(
                    controls=[
                        ft.Row([
                            ft.Icon(name=ft.icons.IMAGE_NOT_SUPPORTED, size=16, color=Theme.TEXT_HINT),
                            ft.Text("Screenshot Preview", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                        ], spacing=8),
                        ft.Container(
                            content=ft.Text("No recent screenshot found", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL),
                            border_radius=Theme.BORDER_RADIUS,
                            bgcolor=Theme.BG_MEDIUM,
                            padding=16,
                            margin=ft.margin.only(top=8),
                            alignment=ft.alignment.center,
                            width=480,
                            height=80
                        )
                    ],
                    spacing=8
                )
        elif preview_type == "download":
            # Create download files preview
            files = preview_data
            
            # Get the current command from input field
            command = self.input_field.value if self.input_field else ""
            parts = command.split()
            input_command = parts[0].lower() if parts else ""

            # Find the best matching command for the usage display
            matches = self.find_matching_commands(input_command)
            if matches:
                # Use the matched command for display, not the raw input
                command_name = matches[0][0]
            else:
                # Fallback to input if somehow no match
                command_name = input_command

            # Determine command description and usage
            description = COMMAND_DESCRIPTIONS.get(command_name, "Transfer files from Downloads folder")
            usage = f"{command_name} [number_of_files | new_filename]"
            
            if files:
                file_controls = []
                for file_name, file_path in files:
                    # Try to determine file type and icon
                    file_ext = os.path.splitext(file_name)[1].lower()
                    file_icon = ft.icons.DESCRIPTION  # Default icon
                    
                    # Map common extensions to icons
                    if file_ext in ['.pdf']:
                        file_icon = ft.icons.PICTURE_AS_PDF
                    elif file_ext in ['.doc', '.docx']:
                        file_icon = ft.icons.ARTICLE
                    elif file_ext in ['.xls', '.xlsx']:
                        file_icon = ft.icons.CALCULATE
                    elif file_ext in ['.ppt', '.pptx']:
                        file_icon = ft.icons.SLIDESHOW
                    elif file_ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
                        file_icon = ft.icons.IMAGE
                    elif file_ext in ['.zip', '.rar', '.7z']:
                        file_icon = ft.icons.FOLDER_ZIP
                    elif file_ext in ['.mp3', '.wav', '.flac', '.aac']:
                        file_icon = ft.icons.AUDIO_FILE
                    elif file_ext in ['.mp4', '.mov', '.avi', '.mkv']:
                        file_icon = ft.icons.VIDEO_FILE
                    
                    # Create a row for each file
                    file_controls.append(
                        ft.Container(
                            content=ft.Row([
                                ft.Icon(name=file_icon, size=16, color=Theme.TEXT_SECONDARY),
                                ft.Column([
                                    ft.Text(
                                        file_name,
                                        color=Theme.TEXT_PRIMARY,
                                        size=Theme.FONT_SMALL,
                                        no_wrap=True,
                                        overflow=ft.TextOverflow.ELLIPSIS,
                                        tooltip=file_name
                                    ),
                                    ft.Text(
                                        f"{os.path.getsize(file_path) / 1024:.1f} KB",
                                        color=Theme.TEXT_HINT,
                                        size=10
                                    )
                                ], spacing=0, expand=True)
                            ], spacing=8, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                            padding=ft.padding.all(8),
                            border_radius=Theme.BORDER_RADIUS,
                            animate=ft.animation.Animation(150, ft.AnimationCurve.EASE_OUT),
                            bgcolor=Theme.BG_MEDIUM,
                            ink=True,
                            on_hover=lambda e: self.on_file_hover(e),
                        )
                    )
                return ft.Column(
                    controls=[
                        # Add command description and usage at the top
                        ft.Row([
                            ft.Icon(name=Theme.get_command_icon(command_name), size=16, color=Theme.TEXT_HINT),
                            ft.Text("Files to Transfer", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                        ], spacing=8),
                        
                        # Add command description and usage info
                        ft.Container(
                            content=ft.Column([
                                ft.Text(description, color=Theme.TEXT_PRIMARY, size=Theme.FONT_SMALL),
                                ft.Container(
                                    content=ft.Text(
                                        f"Usage: {usage}",
                                        color=Theme.TEXT_HINT,
                                        size=Theme.FONT_SMALL,
                                        font_family="Consolas"
                                    ),
                                    bgcolor=Theme.BG_DARK,
                                    border_radius=4,
                                    padding=8,
                                    margin=ft.margin.only(top=4, bottom=8)
                                )
                            ]),
                            padding=ft.padding.all(8),
                            bgcolor=Theme.BG_MEDIUM,
                            border_radius=Theme.BORDER_RADIUS,
                            margin=ft.margin.only(top=8, bottom=8)
                        ),
                        
                        # File preview header
                        ft.Row([
                            ft.Icon(name=ft.icons.DOWNLOAD, size=16, color=Theme.TEXT_HINT),
                            ft.Text(
                                f"Preview of {len(files)} file{'s' if len(files) > 1 else ''} to transfer:", 
                                color=Theme.TEXT_SECONDARY, 
                                size=Theme.FONT_SMALL
                            )
                        ], spacing=8),
                        
                        # File list container
                        ft.Container(
                            content=ft.Column(
                                controls=file_controls,
                                spacing=4,
                                scroll=ft.ScrollMode.AUTO
                            ),
                            border_radius=Theme.BORDER_RADIUS,
                            padding=ft.padding.all(8),
                            bgcolor=Theme.BG_MEDIUM,
                            width=480,
                            height=min(50 + len(file_controls) * 50, 240),
                            margin=ft.margin.only(top=8)
                        )
                    ],
                    spacing=4
                )
            else:
                # Command help preview - ENHANCED with argument guidance
                if preview_type is not None and preview_type.startswith("command_"):
                    command_name = preview_type.split("_")[1]
                else:
                    command_name = preview_data if isinstance(preview_data, str) else None
                
                if command_name and command_name in COMMAND_DESCRIPTIONS:
                    # Find command usage information
                    help_title = f"Command: {command_name}"
                    help_desc = COMMAND_DESCRIPTIONS.get(command_name, "No description available")
                    
                    # Find category for this command
                    category = None
                    for cat, cmds in COMMAND_CATEGORIES.items():
                        if command_name in cmds:
                            category = cat
                            break
                    
                    # Determine argument usage based on command
                    arg_usage = ""
                    arg_examples = []
                    
                    # Transfer-type commands (moveDL)
                    transfer_commands = ["transfer", "far", "depn", "disposal", "gstr", "gstt", 
                                        "payer", "payet", "ap", "ar", "fees", "curr", "ent", 
                                        "acct", "gstrec", "fa", "xc", "lc", "gl","ftransfer"]
                    
                    # Screenshot-type commands
                    screenshot_commands = ["sc", "dep", "feeds", "lfeeds"]
                    
                    # Template commands with filename arguments
                    template_commands = ["wp", "IR3", "GST", "int", "acc", "time", "checklist", "div"]
                    
                    if command_name in transfer_commands:
                        arg_usage = f"{command_name} [number_of_files | new_filename]"
                        arg_examples = [
                            f"{command_name}  # transfers 1 file with original name",
                            f"{command_name} 3  # transfers 3 most recent files",
                            f"{command_name} \"New Name\"  # transfers 1 file with new name"
                        ]
                    elif command_name in screenshot_commands:
                        arg_usage = f"{command_name} [new_filename]"
                        arg_examples = [
                            f"{command_name}  # moves screenshot with original name",
                            f"{command_name} \"My Screenshot\"  # moves and renames screenshot"
                        ]
                    elif command_name == "merge":
                        arg_usage = f"{command_name} [output_filename]"
                        arg_examples = [
                            f"{command_name} \"Combined\"  # merges PDFs to Combined.pdf"
                        ]
                    elif command_name == "append":
                        arg_usage = f"{command_name} \"text_to_append\""
                        arg_examples = [
                            f"{command_name} \"DRAFT\"  # appends '- DRAFT' to all filenames"
                        ]
                    elif command_name == "extractPdf":
                        arg_usage = f"{command_name} \"input.pdf\""
                        arg_examples = [
                            f"{command_name} \"Document.pdf\"  # extracts pages (prompts for range)"
                        ]
                    elif command_name in template_commands:
                        arg_usage = f"{command_name}"
                        arg_examples = [
                            f"{command_name}  # creates template in current directory"
                        ]
                    else:
                        arg_usage = f"{command_name} [arguments]"
                    
                    # Create help content with enhanced argument display
                    return ft.Column(
                        controls=[
                            ft.Row([
                                ft.Icon(name=Theme.get_command_icon(command_name), size=16, color=Theme.TEXT_HINT),
                                ft.Text(help_title, color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                            ], spacing=8),
                            ft.Container(
                                content=ft.Column([
                                    ft.Text(help_desc, color=Theme.TEXT_PRIMARY, size=Theme.FONT_MEDIUM),
                                    ft.Container(height=12),
                                    
                                    # Command category
                                    ft.Row([
                                        ft.Icon(ft.icons.CATEGORY, size=14, color=Theme.TEXT_HINT),
                                        ft.Text("Category:", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL),
                                        ft.Text(category or "Uncategorized", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL)
                                    ], spacing=8, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                                    
                                    ft.Container(height=12),
                                    
                                    # Usage section - ENHANCED
                                    ft.Row([
                                        ft.Icon(ft.icons.CODE, size=14, color=Theme.TEXT_HINT),
                                        ft.Text("Usage:", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL),
                                    ], spacing=8, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                                    
                                    ft.Container(
                                        content=ft.Text(
                                            arg_usage,
                                            color=Theme.ACCENT,
                                            size=Theme.FONT_SMALL,
                                            font_family="Consolas"
                                        ),
                                        bgcolor=Theme.BG_DARK,
                                        border_radius=4,
                                        padding=8,
                                        margin=ft.margin.only(top=4, left=24)
                                    ),
                                    
                                    # Examples section - if available
                                    *([
                                        ft.Container(height=12),
                                        ft.Row([
                                            ft.Icon(ft.icons.LIGHTBULB_OUTLINE, size=14, color=Theme.TEXT_HINT),
                                            ft.Text("Examples:", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL),
                                        ], spacing=8, vertical_alignment=ft.CrossAxisAlignment.CENTER),
                                        
                                        ft.Container(
                                            content=ft.Column([
                                                ft.Text(
                                                    example,
                                                    color=Theme.TEXT_SECONDARY,
                                                    size=Theme.FONT_SMALL,
                                                    font_family="Consolas"
                                                ) for example in arg_examples
                                            ], spacing=4),
                                            bgcolor=Theme.BG_DARK,
                                            border_radius=4,
                                            padding=8,
                                            margin=ft.margin.only(top=4, left=24)
                                        )
                                    ] if arg_examples else [])
                                ]),
                                border_radius=Theme.BORDER_RADIUS,
                                bgcolor=Theme.BG_MEDIUM,
                                padding=16,
                                margin=ft.margin.only(top=8),
                                width=480
                            )
                        ],
                        spacing=8
                    )
                else:
                    # Unknown command or no command - default preview
                    return ft.Container(
                        content=ft.Text("Type a command to begin...", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL),
                        padding=16,
                        border_radius=Theme.BORDER_RADIUS,
                        bgcolor=Theme.BG_MEDIUM,
                        width=480,
                        margin=ft.margin.only(top=16)
                    )
    
    def on_file_hover(self, e):
        """Handle file hover animation."""
        if e.data == "true":  # Mouse entered
            e.control.bgcolor = Theme.BG_LIGHT
            e.control.update()
        else:  # Mouse exited
            e.control.bgcolor = Theme.BG_MEDIUM
            e.control.update()
    
    def create_command_list_item(self, command, description, is_selected=False):
        """Create a command list item for the suggestions list."""
        return ft.Container(
            content=ft.Row(
                [
                    ft.Icon(
                        name=Theme.get_command_icon(command),
                        color=Theme.ACCENT if is_selected else Theme.TEXT_SECONDARY,
                        size=20,
                    ),
                    ft.Column(
                        [
                            ft.Text(
                                command,
                                color=Theme.TEXT_PRIMARY if is_selected else Theme.TEXT_SECONDARY,
                                size=Theme.FONT_MEDIUM,
                                weight=ft.FontWeight.BOLD if is_selected else ft.FontWeight.NORMAL,
                            ),
                            ft.Text(
                                description,
                                color=Theme.TEXT_SECONDARY if is_selected else Theme.TEXT_HINT,
                                size=Theme.FONT_SMALL,
                            ),
                        ],
                        spacing=2,
                        expand=True,
                    ),
                ],
                spacing=16,
                alignment=ft.MainAxisAlignment.START,
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            padding=ft.padding.all(12),
            border_radius=Theme.BORDER_RADIUS,
            bgcolor=Theme.BG_LIGHT if is_selected else Theme.BG_MEDIUM,
            animate=ft.animation.Animation(150, ft.AnimationCurve.EASE_OUT),
            on_hover=lambda e: self.on_command_hover(e, command),
            ink=True,
            on_click=lambda e: self.on_command_click(e, command),
        )
    
    def on_command_hover(self, e, command):
        """Handle command hover animation."""
        # Only change appearance if it's not already selected
        if getattr(e.control, "data", None) != "selected":
            if e.data == "true":  # Mouse entered
                e.control.bgcolor = Theme.BG_LIGHT
                e.control.content.controls[0].color = Theme.ACCENT
                e.control.content.controls[1].controls[0].color = Theme.TEXT_PRIMARY
                e.control.update()
            else:  # Mouse exited
                e.control.bgcolor = Theme.BG_MEDIUM
                e.control.content.controls[0].color = Theme.TEXT_SECONDARY
                e.control.content.controls[1].controls[0].color = Theme.TEXT_SECONDARY
                e.control.update()

    def create_execution_animation(self):
        """Create an animation overlay for command execution."""
        # Create a container that will show a circular progress animation
        return ft.Container(
            content=ft.Stack([
                # Background overlay
                ft.Container(
                    bgcolor=ft.colors.with_opacity(0.2, Theme.BG_DARK),
                    border_radius=Theme.BORDER_RADIUS,
                    expand=True
                ),
                
                # Centered animation
                ft.Container(
                    content=ft.Column([
                        ft.ProgressRing(
                            width=40,
                            height=40,
                            stroke_width=4,
                            color=Theme.ACCENT,
                        ),
                        ft.Container(height=8),
                        ft.Text(
                            "Processing...",
                            color=Theme.TEXT_PRIMARY,
                            size=Theme.FONT_SMALL,
                            weight=ft.FontWeight.BOLD
                        )
                    ], 
                    horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    spacing=8),
                    alignment=ft.alignment.center,
                )
            ]),
            expand=True,
            visible=False,
        )

    def show_execution_animation(self, duration_ms=1500):
        """Show execution animation for the specified duration."""
        if not hasattr(self, 'execution_overlay') or not self.execution_overlay:
            return
            
        # Show animation
        self.execution_overlay.visible = True
        self.page.update()
        
        # Create a timer to hide the animation after duration
        def hide_animation():
            time.sleep(duration_ms / 1000)
            self.execution_overlay.visible = False
            self.page.update()
            
            # Now show success animation in status bar
            self.show_status_bar_animation()
        
        # Run in a separate thread to not block UI
        threading.Thread(target=hide_animation, daemon=True).start()

    def show_status_bar_animation(self):
        """Show a success animation in the status bar."""
        if not hasattr(self, 'status_bar_progress') or not self.status_bar_progress:
            return
            
        # Reset progress to 0
        self.status_bar_progress.value = 0
        self.status_bar_progress.visible = True
        self.page.update()
        
        # Create a timer to animate the progress
        def animate_progress():
            for i in range(1, 11):
                time.sleep(0.05)  # 50ms delay between steps
                self.status_bar_progress.value = i / 10
                self.page.update()
            
            time.sleep(0.2)  # Short pause at 100%
            self.status_bar_progress.visible = False
            self.page.update()
        
        # Run in a separate thread to not block UI
        threading.Thread(target=animate_progress, daemon=True).start()
            
    def on_command_click(self, e, command):
        """Handle command click."""
        if self.input_field:
            # Get the current value to check if it changed
            old_value = self.input_field.value
            
            # Set input field value to the clicked command
            self.input_field.value = command
            
            # Update suggestions to match the new command
            self.update_suggestions(command)
            
            # Explicitly update the preview for the new command
            self.update_preview(command)
            
            # If the command has arguments in the previous input,
            # try to preserve them
            if old_value and old_value.startswith(f"{command} "):
                args = old_value[len(command)+1:]
                if args:
                    self.input_field.value = f"{command} {args}"
                    self.update_suggestions(self.input_field.value)
                    self.update_preview(self.input_field.value)
            
            # Ensure the text field is focused
            self.input_field.focus()
            
            # For Flet text fields, we need to use a different approach
            # After setting the value and focus, clear and reset the selection
            # by setting focus again
            def refocus():
                time.sleep(0.1)  # Short delay
                self.input_field.focus()
                self.page.update()
                
            threading.Thread(target=refocus, daemon=True).start()
            
            # Update the UI immediately with the new value
            self.input_field.update()
    
    def find_matching_commands(self, prefix: str) -> List[Tuple[str, str]]:
        """Find commands matching the given prefix."""
        # If the prefix contains arguments, only match the command name part
        prefix_parts = prefix.split()
        command_prefix = prefix_parts[0] if prefix_parts else ""
        
        # Find matching commands and include descriptions
        matches = []
        for cmd in FUNCTION_MAP.keys():
            if cmd.lower().startswith(command_prefix.lower()):
                matches.append((cmd, COMMAND_DESCRIPTIONS.get(cmd, "")))
        
        # Sort matches by length first (shorter is better), then alphabetically
        matches.sort(key=lambda x: (len(x[0]), x[0]))
        
        return matches


    def get_download_file_suggestions(self, max_files=15):
        """Get a list of the most recent files from Downloads folder for suggestions."""
        try:
            downloads = os.path.join(os.environ["USERPROFILE"], "Downloads")
            if not os.path.exists(downloads):
                return []
                
            # Get files and sort by modification time (newest first)
            files = sorted(os.listdir(downloads), key=lambda x: os.path.getmtime(os.path.join(downloads, x)), reverse=True)
            
            # Filter out folders, only include files
            files = [f for f in files if os.path.isfile(os.path.join(downloads, f))]
            
            # Limit to max_files
            return files[:max_files]
        except Exception as e:
            print(f"Error getting download file suggestions: {e}")
            return []

    def get_frequent_file_suggestions(self, filter_text=""):
        """Get a list of frequent file names, optionally filtered by text."""
        if not filter_text:
            return FREQUENT_FILE_NAMES
        
        # Filter the list based on input
        filter_text = filter_text.lower()
        return [name for name in FREQUENT_FILE_NAMES if filter_text in name.lower()]

    def create_file_suggestion_item(self, filename):
        """Create a suggestion item for a frequent file name."""
        # Determine icon based on file pattern
        file_icon = ft.icons.DESCRIPTION  # Default icon
        
        # Map common file patterns to icons
        if "GST" in filename:
            file_icon = ft.icons.RECEIPT
        elif "Current Account" in filename:
            file_icon = ft.icons.ACCOUNT_BALANCE
        elif "ACC Invoice" in filename:
            file_icon = ft.icons.ACCOUNT_BALANCE
        elif "Home Office" in filename:
            file_icon = ft.icons.HOME_WORK
        
        # Create the suggestion item
        return ft.Container(
            content=ft.Row(
                [
                    ft.Icon(
                        name=file_icon,
                        color=Theme.TEXT_SECONDARY,
                        size=20,
                    ),
                    ft.Column(
                        [
                            ft.Text(
                                filename,
                                color=Theme.TEXT_SECONDARY,
                                size=Theme.FONT_MEDIUM,
                                overflow=ft.TextOverflow.ELLIPSIS,
                                no_wrap=True,
                            ),
                            ft.Text(
                                "Frequent file name",
                                color=Theme.TEXT_HINT,
                                size=Theme.FONT_SMALL,
                            ),
                        ],
                        spacing=2,
                        expand=True,
                    ),
                ],
                spacing=16,
                alignment=ft.MainAxisAlignment.START,
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
            ),
            padding=ft.padding.all(12),
            border_radius=Theme.BORDER_RADIUS,
            bgcolor=Theme.BG_MEDIUM,
            animate=ft.animation.Animation(150, ft.AnimationCurve.EASE_OUT),
            on_hover=lambda e: self.on_command_hover(e, filename),
            ink=True,
            # When clicked, append the filename to the transfer command
            on_click=lambda e, filename=filename: self.on_file_suggestion_click(e, filename),
            data=filename,  # Store filename in data for reference
        )

    def on_file_suggestion_click(self, e, filename):
        """Handle click on a file suggestion item."""
        if self.input_field:
            # Replace the input field value with the transfer command + filename
            # Use double quotes to properly handle filenames with spaces
            self.input_field.value = f'transfer "{filename}"'
            
            # First focus the input field
            self.input_field.focus()
            
            # Update preview to show the selected file
            self.update_preview(self.input_field.value)
            
            # For Flet text fields, we need a different approach to move cursor to end
            def refocus():
                time.sleep(2)  # Short delay
                self.input_field.focus()
                self.page.update()
                self.log('test',)
                
            threading.Thread(target=refocus, daemon=True).start()
            
            # Update the UI immediately with the new value
            self.input_field.update()

    def update_suggestions(self, text: str):
        """Update command suggestions based on input text."""
        if not self.suggestions_list or not self.page:
            return
                
        # Clear the list
        self.suggestions_list.controls.clear()
        
        # Check if this is the transfer command with or without additional arguments
        is_transfer_command = False
        if text.strip().lower() == "transfer":
            # Exact match for "transfer" - show file suggestions instead of commands
            is_transfer_command = True
        elif text.lower().startswith("transfer "):
            # Transfer command with arguments - still show file suggestions
            # This allows for progressive filtering as user types
            is_transfer_command = True
        
        # Special handling for transfer command
        if is_transfer_command:
            # Get the file name part (if any) for filtering
            file_filter = ""
            if " " in text:
                file_filter = text.split(" ", 1)[1].strip().lower()
                # Remove quotes from filter if present
                if file_filter.startswith('"') and file_filter.endswith('"'):
                    file_filter = file_filter[1:-1]
                elif file_filter.startswith("'") and file_filter.endswith("'"):
                    file_filter = file_filter[1:-1]
            
            # Get frequent file suggestions
            files = self.get_frequent_file_suggestions(file_filter)
            
            # Add header for file suggestions
            self.suggestions_list.controls.append(
                ft.Text(
                    f"Frequently Used Files ({len(files)} files found)",
                    color=Theme.TEXT_HINT,
                    size=Theme.FONT_SMALL
                )
            )
            
            # Add file suggestions
            if files:
                for filename in files:
                    self.suggestions_list.controls.append(
                        self.create_file_suggestion_item(filename)
                    )
                
                # Set the first item as selected
                if len(files) > 0:
                    self.selected_command_index = 0
                    # The first item would be at index 1 (after the header)
                    self.suggestions_list.controls[1].bgcolor = Theme.BG_LIGHT
                    if isinstance(self.suggestions_list.controls[1].content, ft.Row) and len(self.suggestions_list.controls[1].content.controls) >= 2:
                        if hasattr(self.suggestions_list.controls[1].content.controls[0], 'color'):
                            self.suggestions_list.controls[1].content.controls[0].color = Theme.ACCENT
                        
                        if isinstance(self.suggestions_list.controls[1].content.controls[1], ft.Column) and len(self.suggestions_list.controls[1].content.controls[1].controls) >= 1:
                            if hasattr(self.suggestions_list.controls[1].content.controls[1].controls[0], 'color'):
                                self.suggestions_list.controls[1].content.controls[1].controls[0].color = Theme.TEXT_PRIMARY
            else:
                # No matching files
                self.suggestions_list.controls.append(
                    ft.Container(
                        content=ft.Column([
                            ft.Icon(name=ft.icons.FOLDER_OFF, color=Theme.TEXT_HINT, size=32),
                            ft.Text("No matching files found", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL)
                        ], spacing=8, alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                        padding=24,
                        alignment=ft.alignment.center
                    )
                )
            
            # Update the UI
            self.suggestions_list.update()
            return
        
        if not text:
            # If no text, show category-based suggestions
            self.suggestions_list.controls.append(
                ft.Text("Popular Commands", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL)
            )
            
            # Show a curated list of most common commands
            popular_commands = ["wp", "transfer", "IR3", "extract", "GST", "sc", "dailies", "merge"]
            for cmd in popular_commands:
                self.suggestions_list.controls.append(
                    self.create_command_list_item(cmd, COMMAND_DESCRIPTIONS.get(cmd, ""))
                )
        else:
            # Extract command name from text with quote support
            command_name = ""
            
            # Check if the command has quotes
            if '"' in text or "'" in text:
                # Get command before the first space
                space_index = text.find(" ")
                if space_index > 0:
                    command_name = text[:space_index].strip().lower()
                else:
                    command_name = text.lower()
            else:
                # Simple split
                parts = text.split()
                command_name = parts[0].lower() if parts else ""
            
            # Get matching commands
            matches = self.find_matching_commands(command_name)
            
            if matches:
                # Add a label for matches
                self.suggestions_list.controls.append(
                    ft.Text(
                        f"Found {len(matches)} matching command{'' if len(matches) == 1 else 's'}",
                        color=Theme.TEXT_HINT,
                        size=Theme.FONT_SMALL
                    )
                )
                
                # Add each matching command
                first_item = True  # Flag for the first item
                for cmd, desc in matches[:10]:  # Limit to 10 suggestions
                    self.suggestions_list.controls.append(
                        self.create_command_list_item(cmd, desc, is_selected=first_item)
                    )
                    # Mark the first item as selected
                    if first_item:
                        self.selected_command_index = 0
                        first_item = False
                
                # If there are more matches, add a note
                if len(matches) > 10:
                    self.suggestions_list.controls.append(
                        ft.Container(
                            content=ft.Text(
                                f"...and {len(matches) - 10} more matching commands",
                                color=Theme.TEXT_HINT,
                                size=Theme.FONT_SMALL,
                                italic=True
                            ),
                            padding=ft.padding.symmetric(horizontal=12, vertical=8)
                        )
                    )
            else:
                # No matches found
                self.suggestions_list.controls.append(
                    ft.Container(
                        content=ft.Column([
                            ft.Icon(name=ft.icons.SEARCH_OFF, color=Theme.TEXT_HINT, size=32),
                            ft.Text("No matching commands", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL)
                        ], spacing=8, alignment=ft.MainAxisAlignment.CENTER, horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                        padding=24,
                        alignment=ft.alignment.center
                    )
                )
        
        # Update the UI
        self.suggestions_list.update()
    
    def update_preview(self, command: str):
        """Update the preview based on the command."""
        if not self.preview_container or not self.page:
            return
                
        # Parse the command and arguments with quotes support
        command_name = ""
        command_args_str = ""
        
        # Check if the command includes quotes for arguments
        if '"' in command or "'" in command:
            # Find the first space to get command name
            space_index = command.find(" ")
            if space_index > 0:
                command_name = command[:space_index].strip()
                # Extract the quoted argument
                remaining = command[space_index:].strip()
                
                # Handle double quotes
                if remaining.startswith('"') and '"' in remaining[1:]:
                    end_quote = remaining.find('"', 1)
                    if end_quote > 0:
                        command_args_str = remaining[1:end_quote]
                # Handle single quotes
                elif remaining.startswith("'") and "'" in remaining[1:]:
                    end_quote = remaining.find("'", 1)
                    if end_quote > 0:
                        command_args_str = remaining[1:end_quote]
                else:
                    # Fallback to simple splitting if quotes aren't properly closed
                    command_args_str = remaining.strip('"\'')
            else:
                command_name = command
        else:
            # Simple split for commands without quotes
            parts = command.split(maxsplit=1)
            command_name = parts[0].lower() if parts else ""
            command_args_str = parts[1] if len(parts) > 1 else ""
        
        # If no command or empty command, show default preview
        if not command_name:
            if self.last_preview_type is not None:
                self.preview_container.content = self.create_preview_content(None, None)
                self.last_preview_type = None
            return
        
        # Find matching commands for the current input
        matches = self.find_matching_commands(command_name)
        
        # Map of command types to preview types
        screenshot_commands = ["sc", "dep", "feeds", "lfeeds"]
        download_commands = ["transfer", "far", "depn", "disposal", "gstr", "gstt", 
                            "payer", "payet", "ap", "ar", "fees", "curr", "ent", 
                            "acct", "gstrec", "fa", "xc", "lc", "gl"]
        
        # Check if there are any matching commands
        if matches:
            # Get the first matching command
            best_match = matches[0][0]  # First match, and get the command name
            
            # Update preview based on the best matching command
            if best_match in screenshot_commands:
                # Screenshot preview
                if self.last_preview_type != "screenshot":
                    screenshot_path = self.show_screenshot_preview(self.page)
                    self.preview_container.content = self.create_preview_content("screenshot", screenshot_path)
                    self.last_preview_type = "screenshot"
            elif best_match in ["finals", "ftransfer"]:
                # Finals/Finals Transfer preview
                finals_dir = os.path.join(self.current_dir, "Finals")
                finals_exists = os.path.exists(finals_dir)
                
                if best_match == "finals":
                    # Finals command preview
                    if finals_exists:
                        # Find potential files that would be renamed
                        preview_files = []
                        
                        # Look for PDF files that match tax return or financial statement patterns
                        tax_type_map = {
                            "IR3": "Individual Tax Return",
                            "IR4": "Company Tax Return",
                            "IR6": "Trust Tax Return",
                            "IR526": "Donation Tax Rebate",
                            "IR7": "LTC Tax Return"
                        }
                        
                        try:
                            for filename in os.listdir(finals_dir):
                                if not filename.lower().endswith(".pdf"):
                                    continue
                                
                                file_path = os.path.join(finals_dir, filename)
                                if not os.path.isfile(file_path):
                                    continue
                                
                                # Check for tax return patterns
                                is_match = False
                                clean_name = re.sub(r'\s*\(\d+\)', '', filename)
                                
                                # Check for forms
                                for form_code in tax_type_map:
                                    if form_code in filename and f"{form_code} {tax_type_map[form_code]}" not in filename:
                                        preview_files.append(f"{filename} → [will be renamed]")
                                        is_match = True
                                        break
                                
                                # Check for Financial Statements and Minutes
                                if not is_match:
                                    base = os.path.splitext(filename)[0]
                                    for term in ["Financial Statements", "Minutes", "Profit and Loss"]:
                                        if term in base:
                                            preview_files.append(f"{filename} → [will be renamed]")
                                            is_match = True
                                            break
                            
                            # Create preview content based on found files
                            if preview_files:
                                content_rows = []
                                for i, file_info in enumerate(preview_files[:10]):  # Show first 10
                                    content_rows.append(
                                        ft.Row([
                                            ft.Icon(name=ft.icons.PICTURE_AS_PDF, size=14, color=ft.colors.RED_400),
                                            ft.Text(file_info, size=11, no_wrap=True, overflow=ft.TextOverflow.ELLIPSIS)
                                        ], spacing=4)
                                    )
                                
                                if len(preview_files) > 10:
                                    content_rows.append(
                                        ft.Text(f"...and {len(preview_files) - 10} more files", size=11, italic=True)
                                    )
                                
                                finals_content = ft.Column(
                                    controls=[
                                        ft.Row([
                                            ft.Icon(name=Theme.get_command_icon("finals"), size=16, color=Theme.TEXT_HINT),
                                            ft.Text("Files to be Renamed", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                                        ], spacing=8),
                                        ft.Container(
                                            content=ft.Column([
                                                ft.Text("These files in the Finals folder match renaming patterns:", color=Theme.TEXT_PRIMARY, size=Theme.FONT_SMALL),
                                                ft.Container(height=8),
                                                ft.Column(content_rows, spacing=4),
                                                ft.Container(height=8),
                                                ft.Row([
                                                    ft.Icon(name=ft.icons.INFO_OUTLINE, size=14, color=Theme.TEXT_HINT),
                                                    ft.Text("Files will be renamed to match standard formats for tax returns and financial statements.", 
                                                            color=Theme.TEXT_HINT, size=Theme.FONT_SMALL)
                                                ], spacing=4)
                                            ]),
                                            border_radius=Theme.BORDER_RADIUS,
                                            bgcolor=Theme.BG_MEDIUM,
                                            padding=16,
                                            margin=ft.margin.only(top=8),
                                            width=480
                                        )
                                    ],
                                    spacing=8
                                )
                                self.preview_container.content = finals_content
                                self.last_preview_type = "finals"
                            else:
                                no_files_content = ft.Column(
                                    controls=[
                                        ft.Row([
                                            ft.Icon(name=Theme.get_command_icon("finals"), size=16, color=Theme.TEXT_HINT),
                                            ft.Text("Finals Command", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                                        ], spacing=8),
                                        ft.Container(
                                            content=ft.Column([
                                                ft.Text("No files in the Finals folder match renaming patterns.", color=Theme.TEXT_PRIMARY, size=Theme.FONT_SMALL),
                                                ft.Container(height=8),
                                                ft.Row([
                                                    ft.Icon(name=ft.icons.FOLDER_OPEN, size=14, color=Theme.TEXT_HINT),
                                                    ft.Text(f"Finals folder: {finals_dir}", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL)
                                                ], spacing=4)
                                            ]),
                                            border_radius=Theme.BORDER_RADIUS,
                                            bgcolor=Theme.BG_MEDIUM,
                                            padding=16,
                                            margin=ft.margin.only(top=8),
                                            width=480
                                        )
                                    ],
                                    spacing=8
                                )
                                self.preview_container.content = no_files_content
                                self.last_preview_type = "finals_no_files"
                        except Exception as ex:
                            print(f"Error generating preview: {ex}")
                            error_content = ft.Column(
                                controls=[
                                    ft.Row([
                                        ft.Icon(name=Theme.get_command_icon("finals"), size=16, color=Theme.TEXT_HINT),
                                        ft.Text("Finals Command", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                                    ], spacing=8),
                                    ft.Container(
                                        content=ft.Text(f"Error generating preview: {str(ex)}", color=Theme.ERROR, size=Theme.FONT_SMALL),
                                        border_radius=Theme.BORDER_RADIUS,
                                        bgcolor=Theme.BG_MEDIUM,
                                        padding=16,
                                        margin=ft.margin.only(top=8),
                                        width=480
                                    )
                                ],
                                spacing=8
                            )
                            self.preview_container.content = error_content
                            self.last_preview_type = "finals_error"
                    else:
                        # Finals folder doesn't exist
                        no_finals_content = ft.Column(
                            controls=[
                                ft.Row([
                                    ft.Icon(name=Theme.get_command_icon("finals"), size=16, color=Theme.TEXT_HINT),
                                    ft.Text("Finals Command", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                                ], spacing=8),
                                ft.Container(
                                    content=ft.Column([
                                        ft.Text("Finals folder does not exist in current directory.", color=Theme.TEXT_PRIMARY, size=Theme.FONT_SMALL),
                                        ft.Container(height=8),
                                        ft.Row([
                                            ft.Icon(name=ft.icons.INFO_OUTLINE, size=14, color=Theme.TEXT_HINT),
                                            ft.Text("Use 'ftransfer' command first to create the Finals folder and transfer files to it.", 
                                                    color=Theme.TEXT_HINT, size=Theme.FONT_SMALL)
                                        ], spacing=4),
                                        ft.Container(height=8),
                                        ft.Row([
                                            ft.Icon(name=ft.icons.FOLDER_OPEN, size=14, color=Theme.TEXT_HINT),
                                            ft.Text(f"Expected location: {finals_dir}", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL)
                                        ], spacing=4)
                                    ]),
                                    border_radius=Theme.BORDER_RADIUS,
                                    bgcolor=Theme.BG_MEDIUM,
                                    padding=16,
                                    margin=ft.margin.only(top=8),
                                    width=480
                                )
                            ],
                            spacing=8
                        )
                        self.preview_container.content = no_finals_content
                        self.last_preview_type = "finals_not_exist"
                else:  # ftransfer command
                    # Preview recent Downloads that would be transferred
                    downloads = os.path.join(os.environ["USERPROFILE"], "Downloads")
                    
                    try:
                        if os.path.exists(downloads):
                            all_files = sorted(os.listdir(downloads), key=lambda x: os.path.getmtime(os.path.join(downloads, x)), reverse=True)
                            
                            # Get the number of files to display
                            val = num_files.value.strip() if hasattr(self, 'num_files') and self.num_files else "1"
                            n = int(val) if val.isdigit() else 1
                            
                            # Parse command-line arguments if available
                            if len(parts) > 1:
                                if parts[1].isdigit():
                                    n = int(parts[1])
                            
                            files = all_files[:n]
                            
                            # IMPORTANT: Instead of returning, set preview_container and last_preview_type
                            preview_content = self.create_preview_content("download", [(f, os.path.join(downloads, f)) for f in files])
                            self.preview_container.content = preview_content
                            self.last_preview_type = "download"
                            
                        else:
                            # IMPORTANT: Set content instead of returning
                            self.preview_container.content = ft.Column(
                                controls=[
                                    ft.Row([
                                        ft.Icon(name=Theme.get_command_icon("ftransfer"), size=16, color=Theme.TEXT_HINT),
                                        ft.Text("ftransfer Command", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                                    ], spacing=8),
                                    ft.Container(
                                        content=ft.Text("Downloads folder not found.", color=Theme.TEXT_PRIMARY, size=Theme.FONT_SMALL),
                                        border_radius=Theme.BORDER_RADIUS,
                                        bgcolor=Theme.BG_MEDIUM,
                                        padding=16,
                                        margin=ft.margin.only(top=8),
                                        width=480
                                    )
                                ],
                                spacing=8
                            )
                            self.last_preview_type = "ftransfer_no_downloads"
                    except Exception as ex:
                        # IMPORTANT: Set content instead of returning
                        self.preview_container.content = ft.Column(
                            controls=[
                                ft.Row([
                                    ft.Icon(name=Theme.get_command_icon("ftransfer"), size=16, color=Theme.TEXT_HINT),
                                    ft.Text("ftransfer Command", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                                ], spacing=8),
                                ft.Container(
                                    content=ft.Text(f"Error generating preview: {str(ex)}", color=Theme.ERROR, size=Theme.FONT_SMALL),
                                    border_radius=Theme.BORDER_RADIUS,
                                    bgcolor=Theme.BG_MEDIUM,
                                    padding=16,
                                    margin=ft.margin.only(top=8),
                                    width=480
                                )
                            ],
                            spacing=8
                        )
                        self.last_preview_type = "ftransfer_error"
                    except Exception as ex:
                        return ft.Column(
                            controls=[
                                ft.Row([
                                    ft.Icon(name=Theme.get_command_icon("ftransfer"), size=16, color=Theme.TEXT_HINT),
                                    ft.Text("ftransfer Command", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                                ], spacing=8),
                                ft.Container(
                                    content=ft.Text(f"Error generating preview: {str(ex)}", color=Theme.ERROR, size=Theme.FONT_SMALL),
                                    border_radius=Theme.BORDER_RADIUS,
                                    bgcolor=Theme.BG_MEDIUM,
                                    padding=16,
                                    margin=ft.margin.only(top=8),
                                    width=480
                                )
                            ],
                            spacing=8
                        )
            elif best_match in download_commands:
                # Download preview - Check for arguments
                num_files = 1
                if len(parts) > 1:
                    # Check if second part is a number (transfer N files)
                    if parts[1].isdigit():
                        num_files = int(parts[1])
                    else:
                        # It's a filename - handle as a string
                        num_files = parts[1]
                
                # Always update preview when command text changes
                # This ensures we see updated preview when adding arguments
                files = self.get_download_previews(num_files)
                self.preview_container.content = self.create_preview_content("download", files)
                self.last_preview_type = "download"
            else:
                # Command help preview
                if self.last_preview_type not in ["command_help", best_match]:
                    # Create command help content
                    help_title = f"Command: {best_match}"
                    help_desc = COMMAND_DESCRIPTIONS.get(best_match, "No description available")
                    
                    # Find category for this command
                    category = None
                    for cat, cmds in COMMAND_CATEGORIES.items():
                        if best_match in cmds:
                            category = cat
                            break
                    
                    # Create help content
                    self.preview_container.content = ft.Column(
                        controls=[
                            ft.Row([
                                ft.Icon(name=Theme.get_command_icon(best_match), size=16, color=Theme.TEXT_HINT),
                                ft.Text(help_title, color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                            ], spacing=8),
                            ft.Container(
                                content=ft.Column([
                                    ft.Text(help_desc, color=Theme.TEXT_PRIMARY, size=Theme.FONT_MEDIUM),
                                    ft.Container(height=8),
                                    ft.Row([
                                        ft.Text("Category:", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL),
                                        ft.Text(category or "Uncategorized", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL)
                                    ], spacing=8),
                                    ft.Container(height=4),
                                    ft.Text("Usage:", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL),
                                    ft.Container(
                                        content=ft.Text(
                                            f"{best_match} [arguments]",
                                            color=Theme.TEXT_SECONDARY,
                                            size=Theme.FONT_SMALL,
                                            font_family="Consolas"
                                        ),
                                        bgcolor=Theme.BG_DARK,
                                        border_radius=4,
                                        padding=8,
                                        margin=ft.margin.only(top=4)
                                    )
                                ]),
                                border_radius=Theme.BORDER_RADIUS,
                                bgcolor=Theme.BG_MEDIUM,
                                padding=16,
                                margin=ft.margin.only(top=8),
                                width=480
                            )
                        ],
                        spacing=8
                    )
                    self.last_preview_type = best_match
        else:
            # If no matches and we have a non-empty command, show "unknown command"
            # But only if it's a complete command (user has finished typing)
            # We'll assume they're still typing if the command is very short
            if len(command_name) >= 2:  # Only show "unknown" for commands of 2+ characters
                self.preview_container.content = ft.Column(
                    controls=[
                        ft.Row([
                            ft.Icon(name=ft.icons.HELP_OUTLINE, size=16, color=Theme.TEXT_HINT),
                            ft.Text("Unknown Command", color=Theme.TEXT_SECONDARY, size=Theme.FONT_SMALL, weight=ft.FontWeight.BOLD)
                        ], spacing=8),
                        ft.Container(
                            content=ft.Text(f"Command '{command_name}' is not recognized", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL),
                            border_radius=Theme.BORDER_RADIUS,
                            bgcolor=Theme.BG_MEDIUM,
                            padding=16,
                            alignment=ft.alignment.center,
                            width=480,
                            margin=ft.margin.only(top=8)
                        )
                    ],
                    spacing=8
                )
                self.last_preview_type = "command_help"
            elif self.last_preview_type is not None:
                # For very short partial commands, just clear the preview
                self.preview_container.content = self.create_preview_content(None, None)
                self.last_preview_type = None
        
        # Update the UI
        self.preview_container.update()

    def run_command(self, command: str, page: ft.Page) -> None:
        """Run a command with the given arguments."""
        command = command.strip()
        if not command:
            self.log("Please enter a command", self.status_text, Theme.ERROR)
            return
            
        # Improved command parsing that handles quoted arguments
        command_name = ""
        command_args_str = ""
        
        # Check if the command includes quotes for arguments
        if '"' in command or "'" in command:
            # Find the first space to get command name
            space_index = command.find(" ")
            if space_index > 0:
                command_name = command[:space_index].strip()
                # Extract the quoted argument
                remaining = command[space_index:].strip()
                
                # Handle double quotes
                if remaining.startswith('"') and '"' in remaining[1:]:
                    end_quote = remaining.find('"', 1)
                    if end_quote > 0:
                        command_args_str = remaining[1:end_quote]
                # Handle single quotes
                elif remaining.startswith("'") and "'" in remaining[1:]:
                    end_quote = remaining.find("'", 1)
                    if end_quote > 0:
                        command_args_str = remaining[1:end_quote]
                else:
                    # Fallback to simple splitting if quotes aren't properly closed
                    command_args_str = remaining.strip('"\'')
            else:
                command_name = command
        else:
            # Simple split for commands without quotes
            parts = command.split(maxsplit=1)
            command_name = parts[0]
            command_args_str = parts[1] if len(parts) > 1 else ""
    
        
        # Check if command name exists
        command_name = command_name.lower()
        if command_name not in FUNCTION_MAP:
            self.log(f"Unknown command: {command_name}", self.status_text, Theme.ERROR)
            return

        # Update directory before running command
        self.update_working_directory(page)
        
        # Show execution animation
        self.show_execution_animation()
        
        # Show progress indicator
        if hasattr(self, 'progress_ring'):
            self.progress_ring.visible = True
            page.update()
        
        func, arg_template = FUNCTION_MAP[command_name]
        
        # Special processing for transfer/moveDL command family
        transfer_commands = ["transfer", "far", "depn", "disposal", "gstr", "gstt", 
                            "payer", "payet", "ap", "ar", "fees", "curr", "ent", 
                            "acct", "gstrec", "fa", "xc", "lc", "gl", "ftransfer"]
        
        # Process arguments based on command type and template
        processed_args = []
        
        print(command_args_str)
        if command_name in transfer_commands:
            if command_args_str:
                if command_args_str.isdigit():
                    processed_args = [int(command_args_str)]
                elif arg_template:
                    processed_args = [
                        arg.format(command_args_str) if isinstance(arg, str) and "{" in arg else arg
                        for arg in arg_template
                    ]
                else:
                    processed_args = [command_args_str]
            elif arg_template:
                # No argument provided, but static template exists
                processed_args = arg_template
            
            # Set up for logging messages
            downloads_folder = os.path.join(os.environ["USERPROFILE"], "Downloads")
            files = sorted(os.listdir(downloads_folder), key=lambda x: os.path.getmtime(os.path.join(downloads_folder, x)), reverse=True)
        elif arg_template is None:
            # Command takes arguments directly (like sc)
            if command_args_str:
                processed_args = [command_args_str.strip()]
        elif isinstance(arg_template, str):
            if command_args_str:
                arg_parts = command_args_str.split()
                try:
                    processed_args = [arg_template.format(*arg_parts)]
                except IndexError:
                    # Fallback: not enough args for all placeholders, use whole string
                    processed_args = [arg_template.format(command_args_str.strip())]
            else:
                processed_args = [arg_template]
        elif isinstance(arg_template, list):
            # List of arguments (some might be templates)
            processed_args = []
            for arg in arg_template:
                if isinstance(arg, str) and "{" in arg and "}" in arg:
                    # Template string with placeholders
                    if command_args_str:
                        # Split arguments only if needed for format placeholders
                        if "{1}" in arg:
                            # Need multiple args for multiple placeholders
                            arg_parts = command_args_str.split()
                            processed_args.append(arg.format(*arg_parts))
                        else:
                            # Only one placeholder, use entire remaining string
                            processed_args.append(arg.format(command_args_str.strip()))
                    else:
                        processed_args.append(arg)
                else:
                    processed_args.append(arg)

        # Special handling for accy command - PLACE HERE AFTER processed_args is defined
        if command_name == "accy":
            try:
                result = func(*processed_args)
                if result is not None:
                    # Show a dialog with the result
                    self.show_invoice_total_dialog(result)
                    self.log(f"Calculated invoice total: ${result:,.2f}", self.status_text, Theme.SUCCESS)
                else:
                    self.log("Could not calculate invoice total", self.status_text, Theme.ERROR)
            except Exception as e:
                self.log(f"Error in accy command: {str(e)}", self.status_text, Theme.ERROR)
            finally:
                # Hide progress indicator
                if hasattr(self, 'progress_ring'):
                    self.progress_ring.visible = False
                    page.update()
            return  # Skip the rest of run_command processing

        try:
            self.log(f"Running: {command} in {os.path.basename(self.current_dir)}", 
                    self.status_text, Theme.WARNING)
            
            # Change to the target directory and execute the function
            original_dir = os.getcwd()
            os.chdir(self.current_dir)
            
            # Set up capture for function output
            import io
            from contextlib import redirect_stdout
            f = io.StringIO()
            
            try:
                # Execute the function with processed arguments
                with redirect_stdout(f):
                    func(*processed_args)
                
                # Get the captured output
                output = f.getvalue().strip()
                
                # Clear input field
                if self.input_field:
                    self.input_field.value = ""
                    self.update_suggestions("")
                    self.update_preview("")
                    page.update()
                
                # Create specific log messages based on command type and output
                if command_name in transfer_commands:
                    # For transfer-type commands
                    if processed_args and isinstance(processed_args[0], int):
                        # Multiple files transfer
                        files_count = processed_args[0]
                        files_text = f"{files_count} file{'s' if files_count > 1 else ''}"
                        if files_count > 0 and files:
                            # Include names of files if available
                            if files_count == 1:
                                file_details = f"\"{files[0]}\""
                            else:
                                file_details = f"starting with \"{files[0]}\""
                            self.log(f"{files_text} {file_details} transferred to {os.path.basename(self.current_dir)}", 
                                    self.status_text, Theme.SUCCESS)
                        else:
                            self.log(f"{files_text} transferred to {os.path.basename(self.current_dir)}", 
                                    self.status_text, Theme.SUCCESS)
                    else:
                        # Single file transfer with potential rename
                        if files:
                            orig_filename = files[0]
                            # Check if we're renaming
                            if processed_args and isinstance(processed_args[0], str):
                                new_name = processed_args[0]
                                if "." not in new_name:
                                    # If no extension in the new name, add the original extension
                                    file_ext = os.path.splitext(orig_filename)[1]
                                    new_name_with_ext = new_name + file_ext
                                    self.log(f"\"{orig_filename}\" has been renamed to \"{new_name_with_ext}\" and transferred to {os.path.basename(self.current_dir)}", 
                                            self.status_text, Theme.SUCCESS)
                                else:
                                    # New name already has extension
                                    self.log(f"\"{orig_filename}\" has been renamed to \"{new_name}\" and transferred to {os.path.basename(self.current_dir)}", 
                                            self.status_text, Theme.SUCCESS)
                            else:
                                # No renaming, just transfer
                                self.log(f"\"{orig_filename}\" has been transferred to {os.path.basename(self.current_dir)}", 
                                        self.status_text, Theme.SUCCESS)
                        else:
                            self.log(f"File transferred to {os.path.basename(self.current_dir)}", 
                                    self.status_text, Theme.SUCCESS)
                elif command_name in ["sc", "dep", "feeds", "lfeeds"]:
                    # For screenshot commands
                    screenshots_dir = os.path.join(os.environ["USERPROFILE"], "Pictures", "Screenshots")
                    if os.path.exists(screenshots_dir):
                        screenshot_files = sorted(os.listdir(screenshots_dir), key=lambda x: os.path.getmtime(os.path.join(screenshots_dir, x)), reverse=True)
                        
                        if screenshot_files and len(screenshot_files) > 0:
                            recent_screenshot = screenshot_files[0]
                            
                            # Check if renaming
                            if processed_args and isinstance(processed_args[0], str):
                                # Renaming screenshot
                                new_name = processed_args[0]
                                if "." not in new_name:
                                    # Add original extension if needed
                                    file_ext = os.path.splitext(recent_screenshot)[1]
                                    new_name_with_ext = new_name + file_ext
                                    self.log(f"Screenshot \"{recent_screenshot}\" has been renamed to \"{new_name_with_ext}\" and moved to {os.path.basename(self.current_dir)}", 
                                            self.status_text, Theme.SUCCESS)
                                else:
                                    # New name already has extension
                                    self.log(f"Screenshot \"{recent_screenshot}\" has been renamed to \"{new_name}\" and moved to {os.path.basename(self.current_dir)}", 
                                            self.status_text, Theme.SUCCESS)
                            else:
                                # No renaming
                                self.log(f"Screenshot \"{recent_screenshot}\" has been moved to {os.path.basename(self.current_dir)}", 
                                        self.status_text, Theme.SUCCESS)
                        else:
                            self.log(f"Screenshot moved to {os.path.basename(self.current_dir)}", 
                                    self.status_text, Theme.SUCCESS)
                    else:
                        self.log(f"Screenshot moved to {os.path.basename(self.current_dir)}", 
                                self.status_text, Theme.SUCCESS)
                else:
                    # For other commands, use more descriptive messages
                    if "extracted successfully" in output:
                        self.log(f"Files extracted to {os.path.basename(self.current_dir)}", 
                                self.status_text, Theme.SUCCESS)
                    elif "copied successfully" in output or "copied to" in output:
                        self.log(f"File copied to {os.path.basename(self.current_dir)}", 
                                self.status_text, Theme.SUCCESS)
                    elif "renamed" in output:
                        self.log(f"File renamed in {os.path.basename(self.current_dir)}", 
                                self.status_text, Theme.SUCCESS)
                    elif "Merge complete" in output:
                        self.log(f"PDF files merged successfully", self.status_text, Theme.SUCCESS)
                    else:
                        # Just use a simple success message
                        self.log(f"Command {command} completed", self.status_text, Theme.SUCCESS)
                
                # disabled via "not"
                if hasattr(self, 'page') and not self.page:
                    self.page.open(
                        ft.SnackBar(
                            content=ft.Text(f"Task complete: {command_name}",color=ft.Colors.WHITE),
                            bgcolor=Theme.BG_LIGHT,
                            action_color=Theme.ACCENT,
                            duration=2000
                        )
                    )
                
                # Hide window after successful execution
                
            finally:
                # Change back to the original directory
                os.chdir(original_dir)
            
        except Exception as e:
            self.log(f"Error executing {command}: {str(e)}", self.status_text, Theme.ERROR)
            
            # Show error toast
            if hasattr(self, 'page') and self.page:
                self.page.show_snack_bar(
                    ft.SnackBar(
                        content=ft.Text(f"Error: {str(e)}"),
                        bgcolor=Theme.ERROR,
                        action="Dismiss",
                        action_color=Theme.TEXT_PRIMARY,
                        duration=4000
                    )
                )
        finally:
            # Hide progress
            if hasattr(self, 'progress_ring'):
                self.progress_ring.visible = False
                page.update()


    def register_global_hotkey(self):
        """Register a global hotkey (Ctrl+Space) to show the app."""
        return
        try:
            keyboard.add_hotkey('ctrl+space', self.show_app, suppress=True)
            print("Global hotkey 'Ctrl+Space' registered")
        except Exception as e:
            print(f"Failed to register global hotkey: {e}")
    
    def create_system_tray(self):
        """Create and run a system tray icon for the application."""
        try:
            # Load icon from file
            icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons", "main.ico")
            
            if not os.path.exists(icon_path):
                # Fallback paths if needed
                fallback_paths = [
                    os.path.join(os.getcwd(), "icons", "main.ico"),
                    os.path.join(os.path.dirname(sys.executable), "icons", "main.ico")
                ]
                
                for path in fallback_paths:
                    if os.path.exists(path):
                        icon_path = path
                        break
                else:
                    # Create default icon
                    icon_image = Image.new('RGBA', (64, 64), (0, 120, 215))
            else:
                icon_image = Image.open(icon_path)
            
            # Store the icon image for later use
            self.icon_image = icon_image
            
            # Start tray icon thread
            tray_thread = threading.Thread(target=self.run_tray_icon, daemon=True)
            tray_thread.start()
            
            return True
        except Exception as e:
            print(f"Error preparing system tray: {e}")
            import traceback
            traceback.print_exc()
            return False
        
    def run_tray_icon(self):
        """Run the system tray icon in a non-blocking way."""
        try:
            # Define actions for menu items
            def on_show(icon, item):
                self.show_app()
            
            def on_exit(icon, item):
                print("Exit menu item clicked")
                self.shutdown()
                icon.stop()
            
            # Create the icon
            self.tray_icon = pystray.Icon("AdvancedRun")
            self.tray_icon.icon = self.icon_image
            self.tray_icon.title = "Advanced Run"
            
            # Create a menu
            self.tray_icon.menu = pystray.Menu(
                pystray.MenuItem("Show Launcher", on_show),
                pystray.MenuItem("Exit", on_exit)
            )
            
            # Set up double-click behavior to show app
            self.tray_icon.on_activate = lambda: self.show_app()
            
            # Run the icon - this will block the thread
            self.tray_icon.run()
        except Exception as e:
            print(f"Error running system tray: {e}")
            import traceback
            traceback.print_exc()
    
    def show_app(self):
        """Show the app when hotkey is pressed or tray icon is clicked."""
        if self.page is not None:
            # Restore window position and size
            if hasattr(self, '_saved_left') and self._saved_left is not None:
                self.page.window.left = self._saved_left
            if hasattr(self, '_saved_top') and self._saved_top is not None:
                self.page.window.top = self._saved_top
            if hasattr(self, '_saved_width'):
                self.page.window.width = self._saved_width
            if hasattr(self, '_saved_height'):
                self.page.window.height = self._saved_height
                
            # Make sure it's visible and not minimized
            self.page.window.visible = True
            self.page.window.minimized = False
            self.page.window.focused = True
            self.minimized_to_tray = False
        
            # Center if needed (only if position wasn't saved)
            if not hasattr(self, '_saved_left') or self._saved_left is None:
                self.page.window.center()
            
            # Update working directory to current explorer window
            self.update_working_directory(self.page)
            
            # Force update to apply changes
            self.page.update()
            
            # Focus the input field
            if self.input_field is not None:
                # Use a small delay to ensure the window is fully rendered before focusing
                def delayed_focus():
                    time.sleep(0.1)  # 100ms delay
                    self.input_field.focus()
                    
                    # Clear any previous input
                    self.input_field.value = ""
                    self.update_suggestions("")
                    self.update_preview("")
                    self.page.update()
                
                # Run the delayed focus in a separate thread
                threading.Thread(target=delayed_focus, daemon=True).start()
            
            print("App window shown and input field focused")
    
    def minimize_to_tray(self, page: ft.Page):
        """Hide the window instead of closing it."""
        try:
            # Save current window state for restoration
            self._saved_width = page.window.width
            self._saved_height = page.window.height
            self._saved_left = page.window.left if hasattr(page.window, 'left') else None
            self._saved_top = page.window.top if hasattr(page.window, 'top') else None
            
            # Update focus tracking
            page.window.focused = False
            
            # Try multiple approaches to hide the window
            page.window.visible = False
            
            # Move the window off-screen as an additional hiding technique
            page.window.left = -10000  # Move far off-screen
            page.window.top = -10000
            page.window.minimized = True
            
            # Force an update to apply all changes
            page.update()
            
            self.minimized_to_tray = True
            print("App minimized to tray")
        except Exception as e:
            if self.status_text:
                self.log(f"Error minimizing to tray: {str(e)}", self.status_text, Theme.ERROR)
    
    def shutdown(self):
        """Clean shutdown of the application."""
        try:
            print("Starting shutdown process...")
            # Unregister global hotkeys
            try:
                keyboard.unhook_all()
                print("Global hotkeys unregistered")
            except:
                print("Error unhooking keyboard")
                
            # Stop the tray icon if it exists
            if hasattr(self, 'tray_icon') and self.tray_icon:
                try:
                    print("Stopping tray icon...")
                    self.tray_icon.stop()
                except:
                    print("Error stopping tray icon")
            
            print("Exiting application...")
            # Use sys.exit for cleaner exit
            sys.exit(0)
        except Exception as e:
            print(f"Error during shutdown: {e}")
            import traceback
            traceback.print_exc()
            # Force exit as last resort
            os._exit(1)

    def create_title_bar(self):
        """Create a custom title bar for the application."""
        # App name and icon
        app_title = ft.Text(
            "Advanced Run",
            size=14,
            weight=ft.FontWeight.BOLD,
            color=Theme.TEXT_PRIMARY
        )
        
        # Window control buttons
        def close_clicked(e):
            e.control.bgcolor = Theme.ERROR
            e.control.update()
            time.sleep(0.1)  # Short delay for visual feedback
            self.minimize_to_tray(self.page)
        
        def minimize_clicked(e):
            e.control.bgcolor = Theme.BG_LIGHT
            e.control.update()
            time.sleep(0.1)  # Short delay for visual feedback
            self.page.window.minimized = True
            self.page.update()
        
        close_button = ft.Container(
            content=ft.Icon(ft.icons.CLOSE, size=16, color=Theme.TEXT_PRIMARY),
            width=40,
            height=30,
            border_radius=0,
            ink=True,
            on_click=close_clicked
        )
        
        minimize_button = ft.Container(
            content=ft.Icon(ft.icons.REMOVE, size=16, color=Theme.TEXT_PRIMARY),
            width=40,
            height=30,
            border_radius=0,
            ink=True,
            on_click=minimize_clicked
        )

        # Add hover effects
        def on_window_button_hover(e):
            button = e.control
            if button == close_button:
                button.bgcolor = Theme.ERROR if e.data == "true" else None
            else:
                button.bgcolor = Theme.BG_LIGHT if e.data == "true" else None
            button.update()
        
        close_button.on_hover = on_window_button_hover
        minimize_button.on_hover = on_window_button_hover
        
        # Title bar container
        title_bar = ft.Container(
            content=ft.Row(
                [
                    ft.Row(
                        [
                            ft.Container(
                                content=ft.Icon(ft.icons.TERMINAL, color=Theme.ACCENT, size=20),
                                margin=ft.margin.only(right=8)
                            ),
                            app_title,
                        ],
                        alignment=ft.MainAxisAlignment.START,
                    ),
                    ft.Row(
                        [minimize_button, close_button],
                        spacing=0,
                        alignment=ft.MainAxisAlignment.END,
                    ),
                ],
                spacing=0,
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            bgcolor=Theme.BG_DARK,
            padding=ft.padding.only(left=15, right=0),
            height=40,
        )
        
        # Make title bar draggable
        def on_pan_update(e):
            if e.control != title_bar:
                return
                
            # Get current window position
            current_left = self.page.window.left or 0
            current_top = self.page.window.top or 0
            
            # Calculate new position
            delta_x = e.delta_x
            delta_y = e.delta_y
            
            # Update window position
            self.page.window.left = current_left + delta_x
            self.page.window.top = current_top + delta_y
            self.page.update()
        
        title_bar.on_pan_update = on_pan_update
        
        return title_bar


    def on_keyboard_event(self, e: ft.KeyboardEvent):
        """Handle keyboard navigation."""
        # Handle keyboard navigation
        print(f"Key pressed: {e.key}")

        if not self.input_field_has_focus and len(e.key) == 1 and e.key.isalnum():
            self.input_field.focus()

            self.page.update()
            time.sleep(0.05)
            if len(self.input_field.value) == 0:
                self.input_field.value = e.key
            self.input_field.update()
            self.update_preview(self.input_field.value)
            self.update_suggestions(self.input_field.value)
            return True  # Important

        if e.key == "Escape":
            # Clear text field first
            if self.input_field_has_focus and self.input_field.value != "":
                print(f"Key pressed: {e.key} while input in focus")
                self.input_field.value = ""
                self.update_suggestions("")
                self.update_preview("")
                self.input_field.update()
                return
                
            # Minimize the app
            self.minimize_to_tray(self.page)
            return True
        
        elif e.key in ["Arrow Down", "Tab"] and self.suggestions_list:
            # Navigate down in suggestions
            controls = self.suggestions_list.controls
            if len(controls) > 1:  # First item is the label
                # Update current selection (remove highlight)
                if 0 <= self.selected_command_index < len(controls) - 1:
                    current = controls[self.selected_command_index + 1]  # +1 to skip the label
                    if hasattr(current, 'bgcolor'):
                        current.bgcolor = Theme.BG_MEDIUM
                        
                        # Check if this is a command or file suggestion
                        if isinstance(current.content, ft.Row) and len(current.content.controls) >= 2:
                            if hasattr(current.content.controls[0], 'color'):
                                current.content.controls[0].color = Theme.TEXT_SECONDARY
                            
                            # Handle command suggestion
                            if isinstance(current.content.controls[1], ft.Column) and len(current.content.controls[1].controls) >= 1:
                                if hasattr(current.content.controls[1].controls[0], 'color'):
                                    current.content.controls[1].controls[0].color = Theme.TEXT_SECONDARY
                        
                        current.update()
                
                # Move selection down
                self.selected_command_index = (self.selected_command_index + 1) % (len(controls) - 1)
                
                # Update new selection (add highlight)
                new_selection = controls[self.selected_command_index + 1]  # +1 to skip the label
                if hasattr(new_selection, 'bgcolor'):
                    new_selection.bgcolor = Theme.BG_LIGHT
                    
                    # Check if this is a command or file suggestion
                    if isinstance(new_selection.content, ft.Row) and len(new_selection.content.controls) >= 2:
                        if hasattr(new_selection.content.controls[0], 'color'):
                            new_selection.content.controls[0].color = Theme.ACCENT
                        
                        # Handle command suggestion
                        if isinstance(new_selection.content.controls[1], ft.Column) and len(new_selection.content.controls[1].controls) >= 1:
                            if hasattr(new_selection.content.controls[1].controls[0], 'color'):
                                new_selection.content.controls[1].controls[0].color = Theme.TEXT_PRIMARY
                    
                    new_selection.update()
                    
                    # Check if this is a command or file suggestion and update input field accordingly
                    if hasattr(new_selection, 'data') and new_selection.data and self.input_field:
                        # This is a file suggestion
                        filename = new_selection.data
                        # Update input field with transfer command and filename
                        self.input_field.value = f'transfer "{filename}"'
                        self.update_preview(self.input_field.value)
                        self.input_field.update()
                    elif isinstance(new_selection.content, ft.Row) and len(new_selection.content.controls) >= 2:
                        # This is a command suggestion
                        if isinstance(new_selection.content.controls[1], ft.Column) and len(new_selection.content.controls[1].controls) >= 1:
                            if hasattr(new_selection.content.controls[1].controls[0], 'value'):
                                command = new_selection.content.controls[1].controls[0].value
                                # Update input field with command
                                if self.input_field and command:
                                    self.input_field.value = command
                                    self.input_field.update()
                                    # Update preview
                                    self.update_preview(command)
            
            return True
                
        elif e.key == "Arrow Up" and self.suggestions_list:
            # Navigate up in suggestions
            controls = self.suggestions_list.controls
            if len(controls) > 1:  # First item is the label
                # Update current selection (remove highlight)
                if 0 <= self.selected_command_index < len(controls) - 1:
                    current = controls[self.selected_command_index + 1]  # +1 to skip the label
                    if hasattr(current, 'bgcolor'):
                        current.bgcolor = Theme.BG_MEDIUM
                        
                        # Check if this is a command or file suggestion
                        if isinstance(current.content, ft.Row) and len(current.content.controls) >= 2:
                            if hasattr(current.content.controls[0], 'color'):
                                current.content.controls[0].color = Theme.TEXT_SECONDARY
                            
                            # Handle command suggestion
                            if isinstance(current.content.controls[1], ft.Column) and len(current.content.controls[1].controls) >= 1:
                                if hasattr(current.content.controls[1].controls[0], 'color'):
                                    current.content.controls[1].controls[0].color = Theme.TEXT_SECONDARY
                        
                        current.update()
                
                # Move selection up
                self.selected_command_index = (self.selected_command_index - 1) % (len(controls) - 1)
                if self.selected_command_index < 0:
                    self.selected_command_index = len(controls) - 2  # -1 for 0-based index, -1 for the label
                
                # Update new selection (add highlight)
                new_selection = controls[self.selected_command_index + 1]  # +1 to skip the label
                if hasattr(new_selection, 'bgcolor'):
                    new_selection.bgcolor = Theme.BG_LIGHT
                    
                    # Check if this is a command or file suggestion
                    if isinstance(new_selection.content, ft.Row) and len(new_selection.content.controls) >= 2:
                        if hasattr(new_selection.content.controls[0], 'color'):
                            new_selection.content.controls[0].color = Theme.ACCENT
                        
                        # Handle command suggestion
                        if isinstance(new_selection.content.controls[1], ft.Column) and len(new_selection.content.controls[1].controls) >= 1:
                            if hasattr(new_selection.content.controls[1].controls[0], 'color'):
                                new_selection.content.controls[1].controls[0].color = Theme.TEXT_PRIMARY
                    
                    new_selection.update()
                    
                    # Check if this is a command or file suggestion and update input field accordingly
                    if hasattr(new_selection, 'data') and new_selection.data and self.input_field:
                        # This is a file suggestion
                        filename = new_selection.data
                        # Update input field with transfer command and filename
                        self.input_field.value = f'transfer "{filename}"'
                        self.update_preview(self.input_field.value)
                        self.input_field.update()
                    elif isinstance(new_selection.content, ft.Row) and len(new_selection.content.controls) >= 2:
                        # This is a command suggestion
                        if isinstance(new_selection.content.controls[1], ft.Column) and len(new_selection.content.controls[1].controls) >= 1:
                            if hasattr(new_selection.content.controls[1].controls[0], 'value'):
                                command = new_selection.content.controls[1].controls[0].value
                                # Update input field with command
                                if self.input_field and command:
                                    self.input_field.value = command
                                    self.input_field.update()
                                    # Update preview
                                    self.update_preview(command)
            
            return True
        
        # All other keys are passed through
        return False
    
    def create_keyboard_shortcuts_info(self):
        """Create info about keyboard shortcuts with reduced margin."""
        return ft.Row(
            [
                ft.Container(
                    content=ft.Row(
                        [
                            ft.Text("↵", color=Theme.TEXT_HINT, size=12, weight=ft.FontWeight.BOLD),
                            ft.Text("Run", color=Theme.TEXT_HINT, size=12),
                        ],
                        spacing=4,
                        alignment=ft.MainAxisAlignment.CENTER,
                    ),
                    padding=ft.padding.only(left=8, right=8, top=4, bottom=4),
                    border=ft.border.all(1, Theme.BORDER_LIGHT),
                    border_radius=4,
                ),
                ft.Container(
                    content=ft.Row(
                        [
                            ft.Text("↑↓", color=Theme.TEXT_HINT, size=12, weight=ft.FontWeight.BOLD),
                            ft.Text("Navigate", color=Theme.TEXT_HINT, size=12),
                        ],
                        spacing=4,
                        alignment=ft.MainAxisAlignment.CENTER,
                    ),
                    padding=ft.padding.only(left=8, right=8, top=4, bottom=4),
                    border=ft.border.all(1, Theme.BORDER_LIGHT),
                    border_radius=4,
                ),
                ft.Container(
                    content=ft.Row(
                        [
                            ft.Text("Esc", color=Theme.TEXT_HINT, size=12, weight=ft.FontWeight.BOLD),
                            ft.Text("Minimize", color=Theme.TEXT_HINT, size=12),
                        ],
                        spacing=4,
                        alignment=ft.MainAxisAlignment.CENTER,
                    ),
                    padding=ft.padding.only(left=8, right=8, top=4, bottom=4),
                    border=ft.border.all(1, Theme.BORDER_LIGHT),
                    border_radius=4,
                ),
            ],
            spacing=12,
            alignment=ft.MainAxisAlignment.CENTER,
        )
    
    def window_event(self, e: ft.WindowEvent):
        """Handle window events like activation, resize, etc."""
        print(e.data)
        if e.data == "focus" and self.page.window.visible == True:
            # Window has gained focus/been activated

            if self.input_field:
                self.input_field.focus()
                # Update working directory when window is activated
                self.update_working_directory(self.page)

                # Update the UI
                self.page.update()
                print("Window activated, input field focused")  
        elif e.data == "restore":
            self.show_app()

            print("Window restored, input field focused") 
            print(self.on_keyboard_event)

        elif e.data == "blur":
            # Window has lost focus
            # Minimize to tray after a short delay to prevent immediate re-focus issues
            def delayed_minimize():
                time.sleep(0.2)  # Short delay
                # Check if we're still unfocused before minimizing
                if self.page and not self.page.window.focused:
                    self.minimize_to_tray(self.page)
                    print("Window automatically minimized to tray after losing focus")
            
            # Run the delayed minimize in a separate thread
            threading.Thread(target=delayed_minimize, daemon=True).start()        

    def main(self, page: ft.Page):
        """Main application entry point."""
        self.page = page
        
        # Set window properties
        page.title = "Advanced Run"
        page.window.width = 800
        page.window.height = 600
        page.window.frameless = True
        # page.window.always_on_top = True
        page.window.title_bar_hidden = True
        page.window.focused = True
        page.bgcolor = Theme.BG_DARK
        page.padding = 0
        page.spacing = 0
        page.window.center()
        
        print(f"Window title: {page.title}")

        # Initialize status_text for logging with strict single-line behavior
        self.status_text = ft.Text(
            "Ready",
            color=Theme.SUCCESS,
            size=Theme.FONT_SMALL,
            overflow=ft.TextOverflow.ELLIPSIS,  # Add ellipsis for overflow
            no_wrap=True,  # Prevent wrapping
            text_align=ft.TextAlign.RIGHT,  # Right align the text itself
            max_lines=1,  # Strictly enforce single line
            height=20,  # Fixed height to match container
        )

        # Add status bar progress for success animation
        self.status_bar_progress = ft.ProgressBar(
            width=120, 
            height=4,
            color=Theme.SUCCESS,
            bgcolor=Theme.BG_DARK,
            visible=False,
            value=0
        )
        
        # Initialize progress indicator
        self.progress_ring = ft.ProgressRing(
            width=16, 
            height=16, 
            stroke_width=2, 
            color=Theme.ACCENT,
            visible=False
        )
        
        # Get the current directory path
        self.current_dir = self.get_current_explorer_path()
        
        # Set up directory monitoring in a separate thread
        dir_check_thread = threading.Thread(target=self.monitor_directory, daemon=True)
        dir_check_thread.start()
        
        # Create custom title bar
        title_bar = self.create_title_bar()

        self.dir_text = ft.Text(
                            os.path.basename(self.current_dir),
                            color=Theme.TEXT_SECONDARY,
                            size=Theme.FONT_SMALL,
                            no_wrap=True,
                            overflow=ft.TextOverflow.ELLIPSIS,
                            tooltip=self.current_dir,
                            expand=True,
                        )
        
        # Add it to status_bar content
        # Find this in your main function and replace the status_bar container with this:

        status_bar = ft.Container(
            content=ft.Row(
                [
                    # Directory section - with fixed width to ensure consistent space
                    ft.Container(
                        content=ft.Row(
                            [
                                ft.Icon(
                                    name=ft.icons.FOLDER_OPEN,
                                    color=Theme.TEXT_HINT,
                                    size=16,
                                ),
                                # Directory name with tooltip for full path
                                self.dir_text,
                            ],
                            spacing=8,
                            vertical_alignment=ft.CrossAxisAlignment.CENTER,
                        ),
                        width=200,  # Fixed width for the directory section
                    ),
                    
                    # Progress section - in the middle
                    ft.Container(
                        content=ft.Row(
                            [
                                # Status bar progress
                                self.status_bar_progress,
                                # Progress ring
                                self.progress_ring,
                            ],
                            spacing=8,
                            vertical_alignment=ft.CrossAxisAlignment.CENTER,
                        ),
                        width=140,  # Fixed width for the progress section
                    ),
                    
                    # Status text - takes remaining space but right-aligned
                    ft.Container(
                        content=self.status_text,
                        expand=True,  # Use available space
                        clip_behavior=ft.ClipBehavior.HARD_EDGE,  # Clip any overflow
                        alignment=ft.alignment.center_right,  # Right-align the status text
                        height=20,  # Fixed height to ensure single line
                    ),
                ],
                spacing=8,  # Small spacing between sections
                vertical_alignment=ft.CrossAxisAlignment.CENTER,
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,  # Distribute items with space between
            ),
            padding=ft.padding.symmetric(horizontal=16, vertical=8),
            bgcolor=Theme.BG_DARK,
            border=ft.border.only(top=ft.border.BorderSide(1, Theme.BORDER_DARK)),
            height=36,  # Fixed height for the entire status bar
            margin=0,  # Ensure no margin
        )
        
        # Create the full path text display
        self.full_path_text = ft.Text(
            self.current_dir,
            color=Theme.TEXT_HINT,
            size=Theme.FONT_SMALL,
            no_wrap=True,
            overflow=ft.TextOverflow.ELLIPSIS,
            text_align=ft.TextAlign.CENTER,
            tooltip=self.current_dir,
        )

        # Create execution animation overlay
        self.execution_overlay = self.create_execution_animation()
        
        # Create search field
        self.selected_command_index = -1  # Index of the currently selected command suggestion



        # Register window event handler
        page.window.on_event = self.window_event

        def on_input_change(e):
            text = e.control.value
            
            # Update suggestions
            self.update_suggestions(text)
            
            # Update preview
            self.update_preview(text)
            
            # Update the selected index to 0 if there are suggestions
            if self.suggestions_list and len(self.suggestions_list.controls) > 1:
                self.selected_command_index = 0
            else:
                self.selected_command_index = -1
            
            page.update()
        
        def on_input_submit(e):
            # Run the command
            command = e.control.value.strip()
            if command:
                self.run_command(command, page)


        def _set_focus_flag(self, focused: bool):
            print("Focus event triggered:", focused)
            if self.page.window.minimized == False:
                self.input_field_has_focus = focused

        self._set_focus_flag = _set_focus_flag

        # Search field with PowerToys-like styling
        self.input_field = ft.TextField(
            border_color=Theme.BORDER_LIGHT,
            focused_border_color=Theme.ACCENT,
            color=Theme.TEXT_PRIMARY,
            bgcolor=Theme.BG_MEDIUM,
            border_radius=Theme.BORDER_RADIUS,
            height=48,
            expand=True,
            text_size=Theme.FONT_LARGE,
            cursor_color=Theme.ACCENT,
            cursor_width=2,
            content_padding=ft.padding.only(left=16, right=16, top=12, bottom=12),
            hint_text="Type a command...",
            hint_style=ft.TextStyle(
                color=Theme.TEXT_HINT,
                size=Theme.FONT_LARGE,
            ),
            prefix_icon=ft.icons.SEARCH,
            on_change=on_input_change,
            on_submit=on_input_submit,
            on_focus=lambda e: self._set_focus_flag(self, focused=True),
            on_blur=lambda e: self._set_focus_flag(self, focused=False),
            autofocus=True,
        )

        # Create suggestions list
        self.suggestions_list = ft.Column(
            controls=[
                ft.Text("Popular Commands", color=Theme.TEXT_HINT, size=Theme.FONT_SMALL)
            ],
            spacing=4,
            scroll=ft.ScrollMode.AUTO,
            height=350,
        )
        
        # Initialize with popular commands
        popular_commands = ["wp", "transfer", "IR3", "extract", "GST", "sc", "dailies", "merge"]
        for cmd in popular_commands:
            self.suggestions_list.controls.append(
                self.create_command_list_item(cmd, COMMAND_DESCRIPTIONS.get(cmd, ""))
            )
        
        # Create preview container
        self.preview_container = ft.Container(
            content=self.create_preview_content(None, None),
            padding=ft.padding.all(0),
            bgcolor=Theme.BG_DARK,
            border_radius=Theme.BORDER_RADIUS,
            margin=ft.margin.symmetric(horizontal=16),
        )
        
        # Create keyboard shortcuts info
        keyboard_shortcuts = self.create_keyboard_shortcuts_info()
        
        # Create the main container for search and results
        main_content = ft.Container(
            content=ft.Column(
                [
                    # Search row
                    ft.Container(
                        content=ft.Row(
                            [self.input_field],
                            spacing=16,
                        ),
                        padding=ft.padding.only(left=16, right=16, top=16, bottom=0),
                        margin=0,
                    ),
                    
                    # Full path display
                    ft.Container(
                        content=self.full_path_text,
                        margin=ft.margin.only(top=4, bottom=12),
                        padding=ft.padding.symmetric(horizontal=16),
                    ),
                    
                    # Results container - split view
                    ft.Container(
                        content=ft.Row(
                            [
                                # Left side: Suggestions list
                                ft.Container(
                                    content=self.suggestions_list,
                                    padding=0,
                                    expand=True,
                                    border_radius=Theme.BORDER_RADIUS,
                                ),
                                
                                # Right side: Preview
                                ft.Container(
                                    content=self.preview_container,
                                    padding=0,
                                    expand=True,
                                ),
                            ],
                            spacing=16,
                            alignment=ft.MainAxisAlignment.START,
                        ),
                        padding=ft.padding.only(left=16, right=16, bottom=0),
                        expand=True,
                        margin=0,
                    ),
                    
                    # Keyboard shortcuts with reduced margin
                    ft.Container(
                        content=keyboard_shortcuts,
                        margin=ft.margin.only(top=8, bottom=8),  # Reduced from 16 to 8
                    ),
                ],
                spacing=0,
                expand=True,
            ),
            bgcolor=Theme.BG_DARK,
            expand=True,
            padding=0,
            margin=0,  # Ensure no margin
        )
        
        # Use a more precise layout structure to eliminate excess space
        page.add(
            ft.Container(
                content=ft.Column(
                    [
                        title_bar,  # Custom title bar
                        main_content,  # Main content area (search, suggestions, preview)
                        status_bar,  # Status bar at the bottom
                    ],
                    spacing=0,
                    expand=True,
                ),
                expand=True,
                padding=0,
                margin=0,
            )
        )
        
        # Register keyboard event handler
        page.on_keyboard_event = self.on_keyboard_event

        # Focus the input field
        self.input_field.focus()
        page.update()
    
    def monitor_directory(self):
        """Monitor for directory changes in a separate thread."""
        while True:
            try:
                # Update the working directory
                if self.page:
                    self.update_working_directory(self.page)
                
                # Sleep to avoid high CPU usage
                time.sleep(1)
            except Exception as e:
                print(f"Error in directory monitor: {e}")
                time.sleep(5)  # Longer delay on error

# Main entry point
if __name__ == "__main__":
    AdvancedRun()