on run argv
	if (count of argv) is not 1 then error "Usage: osascript create-utm-vm.applescript /absolute/path/to/ubuntu.iso"
	set isoFile to POSIX file (item 1 of argv)
	set vmName to "Gemma IR Victim"

	tell application "UTM"
		if exists virtual machine named vmName then
			return "VM already exists: " & vmName
		end if

		make new virtual machine with properties {backend:qemu, configuration:{name:vmName, architecture:"aarch64", memory:3072, cpu cores:2, hypervisor:true, uefi:true, directory share mode:none, drives:{{removable:true, source:isoFile}, {guest size:25600}}, network interfaces:{{mode:shared}, {mode:host}}}}
		return "Created VM: " & vmName
	end tell
end run
