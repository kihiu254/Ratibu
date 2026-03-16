import os

file_path = r"c:\Users\evince\Downloads\Ratibu\pesachama-web-new\src\layouts\DashboardLayout.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update Import
old_import = "import { RatibuLogo } from '../components/RatibuLogo'"
new_import = "import { RatibuLogo, RatibuLogoDark } from '../components/RatibuLogo'"
content = content.replace(old_import, new_import)

# 2. Update Sidebar Logo (sidebarOpen)
old_sidebar_logo = '''            {sidebarOpen ? (
              <RatibuLogo className="h-8 w-auto text-slate-900 dark:text-white" />'''
new_sidebar_logo = '''            {sidebarOpen ? (
              <>
                <RatibuLogo className="h-8 w-auto" />
                <RatibuLogoDark className="h-8 w-auto" />
              </>'''
content = content.replace(old_sidebar_logo, new_sidebar_logo)

# 3. Update Mobile Logo
old_mobile_logo = '''              <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
                <RatibuLogo className="h-8 w-auto" />'''
new_mobile_logo = '''              <div className="h-20 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
                <RatibuLogo className="h-8 w-auto" />
                <RatibuLogoDark className="h-8 w-auto" />'''
content = content.replace(old_mobile_logo, new_mobile_logo)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated DashboardLayout.tsx")
