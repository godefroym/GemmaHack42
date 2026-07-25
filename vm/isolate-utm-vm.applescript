on run
	set vmName to "Gemma IR Victim"

	tell application "UTM"
		set targetVM to virtual machine named vmName
		if status of targetVM is not stopped then error "Stop the VM before changing its network."
		set vmConfig to configuration of targetVM
		set network interfaces of vmConfig to {{mode:host}}
		set directory share mode of vmConfig to none
		update configuration of targetVM with vmConfig
		return "VM isolated: host-only network, no shared directory."
	end tell
end run
