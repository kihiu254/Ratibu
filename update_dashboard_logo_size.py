import os

file_path = r"c:\Users\evince\Downloads\Ratibu\pesachama-web-new\src\layouts\DashboardLayout.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update Sidebar Logo size from h-8 to h-14
content = content.replace('<RatibuLogo className="h-8 w-auto" />', '<RatibuLogo className="h-12 w-auto" />')
content = content.replace('<RatibuLogoDark className="h-8 w-auto" />', '<RatibuLogoDark className="h-12 w-auto" />')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated DashboardLayout.tsx logo sizing")
