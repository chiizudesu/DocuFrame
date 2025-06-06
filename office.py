import sys
import shutil
import os
import argparse
import zipfile
import email
from selenium import webdriver
from pathlib import Path
import time
import hashlib
import argparse
import re
from datetime import datetime
import PyPDF2
import ctypes
import fitz
from PyPDF2 import PdfReader, PdfWriter
import pandas as pd
import subprocess



#Global Variables
curr_dir = os.getcwd()
cDriver = r"C:\Users\EdwardMatias\Documents\msedgedriver.exe"
dailiesDir = r"C:\Users\EdwardMatias\Notes\Dailies"


#Functions

def checkSubs():
    root_dir = r'C:\Users\EdwardMatias\Documents\Clients\GST'
    for folder in os.listdir(root_dir):
        folder_path = os.path.join(root_dir, folder)
        if os.path.isdir(folder_path):
            subfolders = [f for f in os.listdir(folder_path)
                        if os.path.isdir(os.path.join(folder_path, f))]
            if len(subfolders) > 1:
                print(folder)



def initiate_cDriver():
    """Initiates the cDriver for Selenium WebDriver."""
    cDriver_path = r"C:\Users\EdwardMatias\Documents\msedgedriver.exe"
    
    if not os.path.exists(cDriver_path):
        raise FileNotFoundError(f"WebDriver not found at {cDriver_path}")
    
    options = webdriver.EdgeOptions()
    options.use_chromium = True  # Ensures compatibility if using Chromium-based Edge
    
    driver = webdriver.Edge(options=options)
    return driver

def pdfText(*args, **kwargs):

    # Get a list of all PDF files in the current working directory
    pdf_files = [file for file in os.listdir(curr_dir) if file.endswith('.pdf')]

    # Function to extract text from a PDF file
    def extract_text_from_pdf(pdf_path):
        text = ""
        # Open the PDF file
        with fitz.open(pdf_path) as doc:
            # Iterate over each page
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text += page.get_text()
        print(sumPDF(text))
        return text
        

    # Loop through all PDF files and extract text
    for pdf_file in pdf_files:
        pdf_path = os.path.join(curr_dir, pdf_file)
        extracted_text = extract_text_from_pdf(pdf_path)
        
        # Create a text file to save the extracted text
        text_file_path = os.path.join(curr_dir, pdf_file.replace('.pdf', '.txt'))
        with open(text_file_path, 'w', encoding='utf-8') as text_file:
            text_file.write(extracted_text)

    print("Text extraction complete. Check the current directory for the text files.")

def sumPDF(*args, **kwargs):
    text = args[0]
    # Regular expression to find the first dollar amount after each "Invoice #"
    invoice_pattern = r"Invoice # \S+(?!.*Payment on.*\n).*?\n(\d{1,3}(?:,\d{3})*\.\d{2})"
    matches = re.findall(invoice_pattern, text, re.DOTALL)
    print(matches)
    
    # Convert matched amounts to float and sum them
    total = sum(float(amount.replace(',', '')) for amount in matches)
    
    return total

def copyINC(*args, **kwargs):
    for filename in os.listdir(curr_dir):
        if filename.startswith("L - "):
            # Construct the new filename by replacing "L - " with "A - "
            new_filename = "A - " + filename[4:]
            
            # Create full paths for the source and destination files
            src = os.path.join(curr_dir, filename)
            dest = os.path.join(curr_dir, new_filename)
            
            # Copy the file
            shutil.copy(src, dest)
            print(f'Copied "{filename}" to "{new_filename}"')


# finals function - only handles renaming files already in the Finals folder
def finals(*args, **kwargs):
    """
    Rename files in the Finals folder according to the finals naming convention.
    Assumes Finals folder already exists and contains files to be renamed.
    """
    import os
    import re
    from datetime import datetime
    
    # Check if Finals folder exists
    finals_dir = os.path.join(os.getcwd())
    if not os.path.exists(finals_dir):
        print(f"Finals folder does not exist in current directory. Create it using ftransfer command first.")
        return None
    
    # Process file renames in the Finals directory
    tax_type_map = {
        "IR3": "Individual Tax Return",
        "IR4": "Company Tax Return",
        "IR6": "Trust Tax Return",
        "IR526": "Donation Tax Rebate",
        "IR7": "LTC Tax Return"
    }
    
    files = []
    renamed_count = 0
    
    try:
        # Get files in Finals directory
        for filename in os.listdir(finals_dir):
            file_path = os.path.join(finals_dir, filename)
            if os.path.isfile(file_path):
                files.append(file_path)
        
        entities = {}
        
        # First pass: identify entities and tax types, rename tax returns
        for file_path in files:
            filename = os.path.basename(file_path)
            if not filename.lower().endswith('.pdf'):
                continue
                
            clean_name = re.sub(r'\s*\(\d+\)', '', filename)
            
            # Try different patterns to match tax returns
            match1 = re.search(r"^(.*?)-\s*(\d{4})\s*-\s*(IR\d{1,4})\.pdf$", clean_name)
            match2 = re.search(r"^(.*?)-\s*(\d{4})\s*(IR\d{1,4})\s", clean_name)
            
            if match1:
                name, year, form_code = match1.groups()
            elif match2:
                name, year, form_code = match2.groups()
            else:
                continue
                
            if form_code not in tax_type_map:
                continue
                
            desc = tax_type_map[form_code]
            entities[name.strip()] = {"Year": year, "Type": form_code, "Desc": desc}
            
            # Rename tax returns if not already in standard format
            if form_code in filename and f"{form_code} {desc}" not in filename:
                new_name = f"{name.strip()} - {year} {form_code} {desc}.pdf"
                new_path = os.path.join(finals_dir, new_name)
                
                if filename != os.path.basename(new_path):  # Only rename if the name will actually change
                    try:
                        os.rename(file_path, new_path)
                        print(f"Renamed: {filename} → {new_name}")
                        renamed_count += 1
                    except Exception as ex:
                        print(f"Error renaming '{filename}': {str(ex)}")
        
        # Second pass: identify financial statements and minutes
        for file_path in files:
            # Skip files that were renamed in the first pass
            if not os.path.exists(file_path):
                continue
                
            filename = os.path.basename(file_path)
            if not filename.lower().endswith('.pdf'):
                continue
                
            base = os.path.splitext(filename)[0]
            base_clean = re.sub(r'\s*\(\d+\)', '', base).replace('_', ' ')
            base_clean = re.sub(r'\s+', ' ', base_clean)
            
            match = re.search(r"^(.*?) - ", base_clean)
            if match and "IR" not in filename:
                key = match.group(1).strip()
                
                if key in entities:
                    year = entities[key]["Year"]
                    
                    if "Financial Statements" in base_clean:
                        suffix = "Financial Statements"
                    elif "Minutes" in base_clean:
                        suffix = "Annual Minutes"
                    elif "Profit and Loss" in base_clean:
                        suffix = "Statement of Profit and Loss"
                    else:
                        continue
                        
                    new_name = f"{key} - {year} {suffix}.pdf"
                    new_path = os.path.join(finals_dir, new_name)
                    
                    if filename != new_name:  # Only rename if the name will actually change
                        try:
                            os.rename(file_path, new_path)
                            print(f"Renamed: {filename} → {new_name}")
                            renamed_count += 1
                        except Exception as ex:
                            print(f"Error renaming '{filename}': {str(ex)}")
        
        if renamed_count > 0:
            print(f"\nRenamed {renamed_count} files in Finals folder.")
        else:
            print("\nNo files matched the renaming patterns.")
            
        # Display the contents of the Finals folder after renaming
        print(f"\nContents of Finals folder:")
        print("-" * 40)
        
        finals_contents = sorted(os.listdir(finals_dir))
        if finals_contents:
            for i, item in enumerate(finals_contents, 1):
                # Get file size in KB
                item_path = os.path.join(finals_dir, item)
                size_kb = os.path.getsize(item_path) / 1024
                # Get modification date
                mod_time = os.path.getmtime(item_path)
                mod_date = datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d %H:%M')
                
                print(f"{i}. {item} ({size_kb:.1f} KB, {mod_date})")
        else:
            print("Finals folder is empty.")
            
        return finals_dir
            
    except Exception as ex:
        print(f"Error in Finals rename: {str(ex)}")
        return None


def carryDailies():
    def extractJobs(note):
        lines = note.split('\n')
        inTodoSection = False
        extractedJobs = []
        currentJob = []
        
        for line in lines:
            # Check for the start of a TODO section
            if '[!TODO]' in line or '> [!TODO]' in line:
                # If we were already processing a TODO section, add it to the list
                if inTodoSection:
                    extractedJobs.append('\n'.join(currentJob))
                    currentJob = []
                inTodoSection = True
                currentJob.append(line)
                continue
            # If we're in a TODO section and encounter a finished task, skip it
            if inTodoSection and '- [x]' in line:
                currentJob.append(line)
                continue
            # If we're in a TODO section and encounter an unfinished task, add it to the current job
            if inTodoSection and '- [ ]' in line:
                currentJob.append(line)
                continue
            # If we're in a TODO section and encounter another TODO section or reach the end, it means the section has ended
            if inTodoSection and (line.strip() == "" or '[!TODO]' in line or '> [!TODO]' in line or line == lines[-1]):
                extractedJobs.append('\n'.join(currentJob))
                currentJob = []
                inTodoSection = False
        return '\n\n'.join(extractedJobs)

    allFiles = sorted([f for f in os.listdir(dailiesDir) if re.match(r'^\d{8}\.md$', f)])
    if len(allFiles) < 2:
        print("Not enough daily notes to process.")
    previousNoteFilename = allFiles[-2]
    
    with open(os.path.join(dailiesDir, previousNoteFilename), 'r') as file:
        previousNoteContent = file.read()
    unfinishedTasks = extractJobs(previousNoteContent)
    
    currentNoteFilename = datetime.now().strftime('%Y%m%d') + ".md"
    with open(os.path.join(dailiesDir, currentNoteFilename), 'r') as file:
        currentNoteContent = file.read()
    
    jobListPos = currentNoteContent.find("#### Job List")
    if jobListPos == -1:
       print("Could not find '#### Job List' in the current daily note.")
    
    updatedContent = currentNoteContent[:jobListPos + len("#### Job List")] + "\n\n" + unfinishedTasks + "\n" + currentNoteContent[jobListPos + len("#### Job List"):]

    with open(os.path.join(dailiesDir, currentNoteFilename), 'w') as file:
        file.write(updatedContent)

    print("Unfinished tasks carried over successfully!")



def merge_pdfs(output_name="Merged", directory=None, log_func=print):
    """
    Merges the first pages of all PDF files in a directory.
    
    Parameters:
    - output_name: str — name of the output PDF (without .pdf extension)
    - directory: str — directory containing the PDFs (defaults to current working directory)
    - log_func: callable — function to call for logging messages (default is print)
    """
    try:
        if not output_name:
            raise ValueError("Output filename not provided.")

        if directory is None:
            directory = os.getcwd()

        output_filename = f"{output_name}.pdf"
        output_path = os.path.join(directory, output_filename)

        # List all PDFs in the directory
        files = sorted([
            f for f in os.listdir(directory)
            if f.lower().endswith(".pdf") and f != output_filename
        ])

        if not files:
            raise FileNotFoundError("No PDF files found to merge.")

        writer = PdfWriter()
        for file in files:
            file_path = os.path.join(directory, file)
            with open(file_path, 'rb') as f:
                reader = PdfReader(f)
                if reader.pages:
                    writer.add_page(reader.pages[0])
                    log_func(f"Added first page of: {file}")
                else:
                    log_func(f"Skipped empty or unreadable file: {file}")

        with open(output_path, 'wb') as out_file:
            writer.write(out_file)

        log_func(f"Merged PDF created: {output_path}")
        return output_path

    except Exception as e:
        log_func(f"Error during PDF merge: {str(e)}")
        return None


def mergeINC(*args, **kwargs):
    """
    Merge PDFs into two separate output files:
    1. PDFs 1-3 into 'L - INC Transactions.pdf' (only if at least one of 1.pdf, 2.pdf, or 3.pdf exists)
    2. PDFs 4-5 into 'A - PIR Rates.pdf' (only if both 4.pdf and 5.pdf exist)
    """
    # Define the merge configurations
    merge_configs = [
        {
            'files': ['1.pdf', '2.pdf', '3.pdf'],
            'output': 'L - INC Transactions.pdf',
            'require_all': False  # Only require at least one file to exist
        },
        {
            'files': ['4.pdf', '5.pdf'],
            'output': 'A - PIR Rates.pdf',
            'require_all': True  # Require all files to exist
        }
    ]

    for config in merge_configs:
        try:
            # Check if we have the required PDFs
            existing_files = [f for f in config['files'] if os.path.exists(f)]
            
            # Skip if no files exist
            if not existing_files:
                print(f"No PDFs found for {config['output']}, skipping...")
                continue
                
            # For "A - PIR Rates.pdf", skip if any required file is missing
            if config['require_all'] and len(existing_files) < len(config['files']):
                print(f"Some required PDFs are missing for {config['output']}, skipping...")
                continue
            
            # Create PDF writer object
            output = PdfWriter()
            
            # Add pages from existing PDFs
            for pdf_file in existing_files:
                print(f"Adding {pdf_file}...")
                # Open the PDF file
                with open(pdf_file, 'rb') as file:
                    # Create PDF reader object
                    reader = PdfReader(file)
                    # Add all pages to output
                    for page in reader.pages:
                        output.add_page(page)
            
            # Only write the output if we have any pages to write
            if len(output.pages) > 0:
                # Write the output PDF
                output_filename = config['output']
                print(f"Writing merged file to {output_filename}...")
                with open(output_filename, 'wb') as outputStream:
                    output.write(outputStream)
                
                print(f"Merge complete for {output_filename}!")
            else:
                print(f"No pages to write for {config['output']}")
                
        except Exception as e:
            print(f"An error occurred while processing {config['output']}: {str(e)}")
            continue


def moveSC(*args, **kwargs):
    screenshots = r"C:\Users\EdwardMatias\Pictures\Screenshots"
    srcFolder = os.listdir(screenshots)
    
    # Sort the files by modification time in descending order
    srcFolder.sort(key=lambda x: os.path.getmtime(os.path.join(screenshots, x)), reverse=True)
    newName = args[0]

    if srcFolder:
        # Get the most recent file
        recentFile = srcFolder[0]
        
        # Get the file format
        fileFormat = os.path.splitext(recentFile)[1]
        
        # Create the new file name with the specified string and file format
        newFile = newName + fileFormat
        
        # Move the file to the current working directory with the new name
        print(recentFile)
        print(newFile)
        shutil.move(os.path.join(screenshots, recentFile), newFile)
        
        print(f"File '{recentFile}' moved and renamed to '{newFile}' successfully!")
    else:
        print("No files found in the specified folder.")

def extractPdf(*args, **kwargs):
    # Create a PdfReader object
    pdfReader = PdfReader(open(args[0], 'rb'))

    # Create a PdfWriter object
    pdfWriter = PdfWriter()

    # Get the page ranges from the user
    pageRanges = input("Enter the page ranges (e.g., 1-5,7,10-12): ")

    # Parse the page ranges
    for pageRange in pageRanges.split(','):
        if '-' in pageRange:
            # Handle range like "1-5"
            start, end = map(int, pageRange.split('-'))
            # Convert to 0-based indexing
            for i in range(start - 1, end):
                if i < len(pdfReader.pages):
                    pdfWriter.add_page(pdfReader.pages[i])
        else:
            # Handle single page like "7"
            page_num = int(pageRange) - 1  # Convert to 0-based indexing
            if page_num < len(pdfReader.pages):
                pdfWriter.add_page(pdfReader.pages[page_num])

    # Create the output file path
    inputFile = args[0]
    outputFile = os.path.splitext(inputFile)[0] + "_modified.pdf"

    # Write the extracted pages to the output file
    with open(outputFile, "wb") as output:
        pdfWriter.write(output)

    print(f"Extracted pages saved to {outputFile}")

def moveDL(*args, **kwargs):
    """
    Transfer files from Downloads folder.
    Usage:
    - moveDL()          # Transfers 1 file with original name
    - moveDL(3)         # Transfers 3 most recent files with original names
    - moveDL("newname") # Transfers 1 file and renames it to newname.ext
    """
    # Get a list of all files in the Downloads folder
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    
    # Check if Downloads directory exists
    if not os.path.exists(downloads):
        print(f"Downloads directory not found: {downloads}")
        return
    
    srcFolder = os.listdir(downloads)
    
    # If no files found
    if not srcFolder:
        print("No files found in Downloads folder")
        return
        
    # Sort the files by modification time in descending order
    srcFolder.sort(key=lambda x: os.path.getmtime(os.path.join(downloads, x)), reverse=True)
    
    # Determine number of files to transfer and whether to rename
    num_files = 1  # Default to 1 file
    rename_to = None
    
    if args:
        # Check first argument type
        if isinstance(args[0], (int, str)) and str(args[0]).isdigit():
            # It's a number - transfer that many files
            num_files = int(args[0])
        elif isinstance(args[0], str):
            # It's a string - rename the file
            rename_to = args[0]
    
    # Limit number of files to available files
    num_files = min(num_files, len(srcFolder))
    
    # Process the specified number of files
    for i in range(num_files):
        current_file = srcFolder[i]
        
        # Determine new filename
        if i == 0 and rename_to:
            # For first file, use the provided name if available
            fileFormat = os.path.splitext(current_file)[1]
            newFile = rename_to + fileFormat
        else:
            # For additional files or if no rename provided, use original filename
            newFile = current_file
            
        try:
            # Move the file to the current working directory
            shutil.move(os.path.join(downloads, current_file), newFile)
            print(f"File '{current_file}' moved and renamed to '{newFile}' successfully!")
        except Exception as e:
            print(f"Error moving file '{current_file}': {str(e)}")
            
    if num_files > 1:
        print(f"\nTransferred {num_files} most recent files from Downloads folder")

def renameFile(*args, **kwargs):
    srcFolder = os.listdir(curr_dir)
    
    # Sort the files by modification time in descending order
    srcFolder.sort(key=lambda x: os.path.getmtime(os.path.join(curr_dir, x)), reverse=True)
    
    recentFile = srcFolder[0]
    newName = args[0]
    # Get the file format
    fileFormat = os.path.splitext(recentFile)[1]
    # Create the new file name with the specified string and file format
    newFile = newName

    # Move the file to the current working directory with the new name
    shutil.move(os.path.join(curr_dir, recentFile), os.path.join(curr_dir, newFile))   
    print(f"File '{recentFile}' moved and renamed to '{newFile}' successfully!")


def saveTemplate(*args, **kwargs):
    template_path = args[0]
    df = pd.read_excel(template_path)

    template_filename = os.path.basename(template_path)
    saved_filename, _ = os.path.splitext(template_filename)
    saved_filename = f'{saved_filename}_saved.xlsx'
    df.to_excel(os.path.join(curr_dir, saved_filename), index=False)
    print(f'File successfully saved in: {curr_dir}')

def copyFile(*args, **kwargs):
    documents = r"C:\Users\EdwardMatias\Documents"
    src_file = os.path.join(documents, args[0])  # Construct the full path to the source file
    
    # Destination directory is the current working directory
    dest_file = os.path.join(curr_dir, args[1]) 
    shutil.copy(src_file, dest_file)
    print(f"File copied successfully from {src_file} to {dest_file}")
 
def drafts(*args, **kwargs):
    for filename in os.listdir(curr_dir):
        original_file_path = os.path.join(curr_dir, filename)
        if not os.path.isfile(original_file_path):
            continue
        new_file_path = os.path.join(curr_dir, "DRAFT - " + filename)
        os.rename(original_file_path, new_file_path)


def createTemplate(*args, **kwargs):
    """
    This function takes in one argument, a template spreadsheet, and copies it to the current working directory.
    """
    template_spreadsheet = args[0]
    target_directory = curr_dir
    shutil.copy(template_spreadsheet, target_directory)

    if "IR 3" in template_spreadsheet:
        old_name = os.path.join(target_directory, os.path.basename(template_spreadsheet))                 
        folder_name = os.path.basename(curr_dir)
        new_name = old_name.replace("Client Name", folder_name)
        new_name = new_name.replace("FY", "FY23")
        os.rename(old_name, new_name)
        os.startfile(new_name)
    else:
        os.startfile(os.path.join(target_directory, os.path.basename(template_spreadsheet)))
    
    print(f"Template spreadsheet [{os.path.basename(template_spreadsheet)}] has been copied to Current Directory.")

def remove_underscores(*args, **kwargs):
    """
    This function goes through all files in the current working directory, and renames any file with an underscore in its name, replacing the underscore with a space.
    """
    # Use the current working directory at execution time, not the global curr_dir
    folder = os.getcwd()
    
    renamed_count = 0
    for file in os.listdir(folder):
        # Only process files, not directories
        if os.path.isfile(os.path.join(folder, file)) and "_" in file:
            # Replace underscores with spaces
            new_name = file.replace("_", " ")
            
            # Full paths for rename operation
            old_path = os.path.join(folder, file)
            new_path = os.path.join(folder, new_name)
            
            try:
                os.rename(old_path, new_path)
                renamed_count += 1
                print(f"Renamed: {file} -> {new_name}")
            except Exception as e:
                print(f"Error renaming {file}: {str(e)}")
    
    if renamed_count > 0:
        print(f"Successfully renamed {renamed_count} files.")
    else:
        print("No files with underscores found.")
    
    return renamed_count > 0

def appendText(*args, **kwargs):
    """
    This function goes through all files in the current working directory, and renames any file with an underscore in its name, replacing the underscore with a space.
    """
    folder = curr_dir
    toAppend = args[0]

    for file in os.listdir(folder):
            newName = f"{file.split('.')[0]} - {toAppend}.{file.split('.')[-1]}"
            os.rename(file, newName)

def copy_fees_summary(*args, **kwargs):
    """
    Find 'Q - Outside - Fees Summary.pdf' in the current directory and
    create a copy renamed to 'G - Outside - Fees Summary.pdf'.
    """
    source_file = "Q - Outside - Fees Summary.pdf"
    dest_file = "G - Outside - Fees Summary.pdf"
    
    if not os.path.exists(source_file):
        print(f"Source file '{source_file}' not found in current directory.")
        return
    
    try:
        shutil.copy(source_file, dest_file)
        print(f"Successfully copied '{source_file}' to '{dest_file}'")
    except Exception as e:
        print(f"Error copying file: {str(e)}")

def open_scripts_folder(*args, **kwargs):
    """
    Open Visual Studio Code in the Scripts folder.
    Uses explicit path to VS Code executable if needed.
    """
    scripts_folder = r"C:\Users\EdwardMatias\Documents\Scripts"
    vscode_paths = [
        # Standard installation paths
        r"C:\Program Files\Microsoft VS Code\Code.exe",
        r"C:\Program Files (x86)\Microsoft VS Code\Code.exe",
        r"C:\Users\EdwardMatias\AppData\Local\Programs\Microsoft VS Code\Code.exe",
        # Just the command if it's in the PATH
        "code"
    ]
    
    if not os.path.exists(scripts_folder):
        print(f"Scripts folder not found at {scripts_folder}")
        return False
    
    success = False
    errors = []
    
    for vscode_path in vscode_paths:
        try:
            if vscode_path == "code":
                # Try using just 'code' command if it's in the PATH
                process = subprocess.Popen(["code", scripts_folder], 
                                         shell=True,
                                         stdout=subprocess.PIPE, 
                                         stderr=subprocess.PIPE)
            else:
                # Try using explicit path to VS Code executable
                if os.path.exists(vscode_path):
                    process = subprocess.Popen([vscode_path, scripts_folder], 
                                             stdout=subprocess.PIPE, 
                                             stderr=subprocess.PIPE)
                else:
                    continue  # Skip this path if it doesn't exist
            
            # Wait a short time to see if process launches
            return_code = process.poll()
            if return_code is None or return_code == 0:
                print(f"VS Code launched with {vscode_path} to open {scripts_folder}")
                success = True
                break
            else:
                stdout, stderr = process.communicate()
                errors.append(f"Process returned code {return_code}: {stderr.decode()}")
        except Exception as e:
            errors.append(f"Error with {vscode_path}: {str(e)}")
    
    if not success:
        print(f"Failed to open VS Code. Errors: {', '.join(errors)}")
        # Try one more approach - using os.startfile
        try:
            os.startfile(scripts_folder)
            print(f"Opened scripts folder with default application: {scripts_folder}")
            success = True
        except Exception as e:
            print(f"Also failed to open with default app: {str(e)}")
    
    return success

def accy(*args, **kwargs):
    """
    Analyses an accounting document like 'Q - Outside - Fees Summary.pdf'
    and calculates the total of all invoices.
    
    The function scans for 'Invoice #' entries and totals the corresponding amounts.
    Displays the result in a dialog box.
    """
    import os
    import re
    import fitz  # PyMuPDF
    
    try:
        # Look for the specific file in the current directory
        target_file = None
        for filename in os.listdir(os.getcwd()):
            if filename.lower().startswith("q - outside - fees summary") and filename.lower().endswith(".pdf"):
                target_file = os.path.join(os.getcwd(), filename)
                break
                
        if target_file is None:
            print("File 'Q - Outside - Fees Summary.pdf' not found in current directory")
            return
        
        print(f"Analyzing file: {os.path.basename(target_file)}")
        
        # Extract text from the PDF
        total_invoice_amount = 0.0
        invoice_matches = []
        
        # Open the PDF
        with fitz.open(target_file) as doc:
            # Extract text from all pages
            full_text = ""
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                full_text += page.get_text()
            
            # Regular expression to find invoice amounts
            # Look for "Invoice #" followed by any text, then a date, then an amount
            pattern = r"Invoice #\s+[^\n]+(?:\n[^\n]+)?(?:\n[^\n]+)?\s+(\d{1,3}(?:,\d{3})*\.\d{2})"
            
            # Alternative pattern that looks for invoice entries more generally
            alt_pattern = r"Invoice #[^\n]*?\s+\d{1,2}\s+[A-Za-z]{3}\s+\d{4}\s+(\d{1,3}(?:,\d{3})*\.\d{2})"
            
            # Find all matches for both patterns
            matches = re.findall(pattern, full_text)
            if not matches:
                matches = re.findall(alt_pattern, full_text)
            
            # Process all matches
            for match in matches:
                # Remove commas and convert to float
                amount_str = match.replace(',', '')
                try:
                    amount = float(amount_str)
                    total_invoice_amount += amount
                    invoice_matches.append((match, amount))
                except ValueError:
                    print(f"Warning: Could not convert '{match}' to a number")
        
        # Print detailed results
        print(f"\nFound {len(invoice_matches)} invoice entries:")
        for i, (original, amount) in enumerate(invoice_matches, 1):
            print(f"{i}. ${original} = ${amount:.2f}")
        
        # Format the total amount with commas
        formatted_total = f"{total_invoice_amount:,.2f}"
        
        print(f"\nTotal invoice amount: ${formatted_total}")
        
        # Return the total (this can be used to display in a dialog)
        return total_invoice_amount
        
    except Exception as e:
        print(f"Error analyzing accounting document: {str(e)}")
        return None

def extractZip(*args, **kwargs):
    """
    This function extracts all files from all zip files located in the current working directory.
    """
    files = os.listdir(os.getcwd())

    for file_name in files:
        # check if file is a zip file
        if file_name.endswith('.zip'):
            # open the zip file
            with zipfile.ZipFile(file_name, 'r') as zip_ref:
                # extract all files
                zip_ref.extractall()
                print(f"All files from {file_name} extracted successfully.")

def compile(*args, **kwargs):
    """
    This function goes through all files in the current working directory and all subdirectories, and moves them to the current working directory.
    """
    for subdir, dirs, files in os.walk(curr_dir):
        for file in files:
            file_path = os.path.join(subdir, file)
            if os.path.isfile(file_path):
                os.rename(file_path, os.path.join(curr_dir, file))


def dlAttachments(*args, **kwargs):
    """
    This function downloads attachments from .eml files located in the current working directory. It creates a folder called 'att' in the current working directory if it does not already exist, and saves the attachments to that folder.
    """
    # check if the folder 'att' exists in current directory
    # if not, create the folder
    if not os.path.exists('att'):
        os.mkdir('att')

    for file in os.listdir(curr_dir):
        if file.endswith(".eml"):
            try:
                with open(os.path.join(curr_dir, file), 'rb') as f:
                    msg = email.message_from_binary_file(f)
                    for part in msg.walk():
                        if part.get_content_maintype() == 'multipart':
                            continue
                        if part.get('Content-Disposition') is None:
                            continue
                        file_name = part.get_filename()
                        if bool(file_name):
                            file_name = file_name.replace("\n", "")
                            # join the 'att' folder with the extracted file name
                            file_path = os.path.join('att', file_name)
                            with open(file_path, 'wb') as new_file:
                                new_file.write(part.get_payload(decode=True))
                            print(f'{file_name} extracted successfully.')
            except Exception as e:
                print(f'An error occurred: {e}')
    return True

# ftransfer function - creates Finals folder and transfers files there
def ftransfer(*args, **kwargs):
    """
    Transfer files from Downloads folder directly to Finals folder.
    Create Finals folder if it doesn't exist.
    
    Usage:
    - ftransfer()          # Transfers 1 file with original name
    - ftransfer(3)         # Transfers 3 most recent files with original names
    - ftransfer("newname") # Transfers 1 file and renames it to newname.ext
    """
    import os
    import shutil
    from datetime import datetime
    
    # Create or ensure Finals folder exists
    finals_dir = os.path.join(os.getcwd(), "Finals")
    if not os.path.exists(finals_dir):
        os.makedirs(finals_dir)
        print(f"Created Finals folder in current directory: {finals_dir}")
    else:
        print(f"Using existing Finals folder: {finals_dir}")
    
    # Get a list of all files in the Downloads folder
    downloads = os.path.join(os.path.expanduser("~"), "Downloads")
    
    # Check if Downloads directory exists
    if not os.path.exists(downloads):
        print(f"Downloads directory not found: {downloads}")
        return
    
    srcFolder = os.listdir(downloads)
    
    # If no files found
    if not srcFolder:
        print("No files found in Downloads folder")
        return
        
    # Sort the files by modification time in descending order
    srcFolder.sort(key=lambda x: os.path.getmtime(os.path.join(downloads, x)), reverse=True)
    
    # Determine number of files to transfer and whether to rename
    num_files = 1  # Default to 1 file
    rename_to = None
    
    if args:
        # Check first argument type
        if isinstance(args[0], (int, str)) and str(args[0]).isdigit():
            # It's a number - transfer that many files
            num_files = int(args[0])
        elif isinstance(args[0], str):
            # It's a string - rename the file
            rename_to = args[0]
    
    # Limit number of files to available files
    num_files = min(num_files, len(srcFolder))
    
    # Process the specified number of files
    for i in range(num_files):
        current_file = srcFolder[i]
        
        # Determine new filename
        if i == 0 and rename_to:
            # For first file, use the provided name if available
            fileFormat = os.path.splitext(current_file)[1]
            newFile = rename_to + fileFormat
        else:
            # For additional files or if no rename provided, use original filename
            newFile = current_file
            
        try:
            # Move the file to the Finals directory
            src_path = os.path.join(downloads, current_file)
            dest_path = os.path.join(finals_dir, newFile)
            
            shutil.move(src_path, dest_path)
            print(f"File '{current_file}' moved to Finals folder as '{newFile}'")
        except Exception as e:
            print(f"Error moving file '{current_file}': {str(e)}")
            
    if num_files > 1:
        print(f"\nTransferred {num_files} most recent files from Downloads to Finals folder")
    
    # Display the contents of the Finals folder after transfer
    print(f"\nContents of Finals folder:")
    print("-" * 40)
    
    if os.path.exists(finals_dir):
        finals_contents = sorted(os.listdir(finals_dir))
        if finals_contents:
            for i, item in enumerate(finals_contents, 1):
                # Get file size in KB
                item_path = os.path.join(finals_dir, item)
                size_kb = os.path.getsize(item_path) / 1024
                # Get modification date
                mod_time = os.path.getmtime(item_path)
                mod_date = datetime.fromtimestamp(mod_time).strftime('%Y-%m-%d %H:%M')
                
                print(f"{i}. {item} ({size_kb:.1f} KB, {mod_date})")
        else:
            print("Finals folder is empty.")
    
    return finals_dir

def merge_text_files(*args, **kwargs):
    output_file_name = "mergedFile.txt"
    with open(output_file_name, 'w', encoding='utf-8') as output_file:
        for root, dirs, files in os.walk(curr_dir):
            for file in files:
                if file.endswith('.txt'):
                    file_path = os.path.join(root, file)
                    with open(file_path, 'r', encoding='utf-8') as f:
                        output_file.write(f.read() + '\n')

# dictionary of functions
functions = {"createTemplate": createTemplate,
             "removeud": remove_underscores,
             "extract": extractZip,
             "compile": compile,
             "att": dlAttachments,
             "drafts": drafts,
             "transfer": moveDL,
             "saveTemplate": saveTemplate,
             "extractPdf":extractPdf,
             "carryDailies":carryDailies,
             "sc":moveSC,
             "merge":merge_pdfs,
             "mergeTxt":merge_text_files,
             "appendText":appendText,
             "copyFile":copyFile,
             "finals":finals,
             "ren":renameFile,
             "copyIRD":copyINC,
             "pdfText":pdfText,
             "mergeINC":mergeINC,
             "edge":initiate_cDriver,
             "subs":checkSubs,
             "copy_fees_summary":copy_fees_summary,  # Add this line
             "open_scripts_folder":open_scripts_folder,  # Add this line
             "ftransfer":ftransfer,
             "accy":accy
             }

parser = argparse.ArgumentParser(description="Run a specific function")

# Define the arguments
parser.add_argument("--function", type=str, choices=functions.keys(), help="the function to run")
parser.add_argument("args", nargs=argparse.REMAINDER, help="arguments for the function")

args = parser.parse_args()

if args.function:
    # call the function using the dictionary
    functions[args.function](*args.args)