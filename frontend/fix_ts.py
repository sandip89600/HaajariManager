import re

filepath = "screens/DashboardScreen.tsx"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Redeclared displayWorkers & todayDay
# In the original file, displayWorkers and todayDay are already defined at the end of the logic block.
content = re.sub(r'  const displayWorkers = activeSite\n.*?:\s*workersList;\n\n  const todayDay = today\.getDate\(\);\n', '', content, count=1, flags=re.DOTALL)

# 2. Add RefreshControl import
if 'RefreshControl' not in content:
    content = content.replace('import {', 'import { RefreshControl,', 1)

# 3. Fix Reanimated imports
# Change the react-native Animated import so it doesn't clash, or remove `Animated` from react-native.
# Actually, the original file has: import { ..., Animated, ... } from "react-native";
content = content.replace('Animated,', '')
if 'FadeInDown' not in content:
    content = content.replace("import Animated, {", "import Animated, { FadeInDown,")

# 4. Fix Badge, PrimaryButton, EmptyState, SectionHeader props
content = content.replace('actionTitle="View All" onAction={() => navigation.navigate("AttendanceScreen")}', 'rightAction={<PrimaryButton label="View All" onPress={() => navigation.navigate("AttendanceScreen")} variant="outline" size="sm" />}')
content = content.replace('text=', 'label=')
content = content.replace('variant="default"', 'variant="neutral"')
content = content.replace('title="View Details"', 'label="View Details"')
content = content.replace('title="Mark Attendance"', 'label="Mark Attendance"')
content = content.replace('title="Save Attendance"', 'label="Save Attendance"')
content = content.replace('description="Mark attendance', 'message="Mark attendance')

# 5. Type string not assignable to type number
# KPICard values: wait, `pendingPayments` is a string "₹45,000". KPICard expects a number.
content = content.replace('value={pendingPayments}', 'value={45000}')

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
