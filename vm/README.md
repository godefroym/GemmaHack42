# Compromised Linux VM

## Quickest path: one command (Docker, cross-platform)

To reproduce a real compromise without UTM, use Docker (installed on the team's
Ubuntu and Mac machines). The victim runs real systemd in a disposable
container, so the service persistence and Service Stop steps are genuine, not
simulated. Run from the workspace root:

```bash
./scripts/run-victim-lab.sh ransomware
```

It builds the victim image, compromises it, collects read-only evidence into
`cases/`, and analyzes it into `artifacts/hospital-ransomware-vm/`. Pass
`intrusion` for the first scenario or `webshell` for the public-facing
application compromise. Destroy the victim with
`docker rm -f gemma-ir-victim`.

The UTM workflow below stays available for the ARM64 demo appliance.

## UTM appliance (manual)

Recommended local configuration:

- UTM virtual machine
- Ubuntu Server 24.04.4 ARM64
- 2 vCPUs
- 3 GB RAM
- 25 GB dynamically allocated disk
- one host-only NIC for the IR link
- no shared clipboard or shared host folders during the final demo

Provisioning sequence:

1. Run `./scripts/create-victim-vm.sh` from the workspace root. This creates
   `Gemma IR Victim` with temporary NAT plus a host-only NIC.
2. Start the VM and attach to its serial console:

   ```bash
   utmctl start "Gemma IR Victim"
   utmctl attach "Gemma IR Victim"
   ```

3. Install Ubuntu with temporary network access.
4. Copy and run `bootstrap-victim.sh`.
5. Shut down and create a clean clone:

   ```bash
   utmctl clone "Gemma IR Victim" --name "Gemma IR Victim - clean"
   ```

6. Run `./scripts/isolate-victim-vm.sh` to remove NAT and shared directories.
7. Run `sudo ./run-scenario.sh` in the disposable VM.
8. Copy `/root/gemma-ir-ground-truth.json` to the analysis host, then remove it
   from the victim.
9. Run `sudo ./collect-evidence.sh` and copy the resulting archive to `cases/`.
10. Optionally create a clone named `Gemma IR Victim - compromised`.

The `ground_truth.json` used for scoring must remain on the analysis host and must
not be included in the evidence collected from the victim.

The scenario uses only synthetic data and harmless persistence. Its outbound
HTTP attempt targets `203.0.113.10`, an address reserved for documentation. The
scripts also require `/etc/gemma-ir-lab/authorized`, created by the bootstrap script, so
they refuse to run on an unmarked Linux machine.

The selected Atomic Red Team definitions are references for the ATT&CK mapping.
The deterministic scenario script is used for the live demo because it produces
the same evidence every time and does not download payloads.

## Ransomware-impact scenario

`run-ransomware-scenario.sh` stages a second, independent case on a clean clone:
the WannaCry-style impact playbook of stopping the PACS service (T1489),
destroying backups and snapshots (T1490), and encrypting imaging data (T1486).
Run it instead of `run-scenario.sh`, then collect with the case id:

```bash
sudo ./run-ransomware-scenario.sh
sudo ./collect-evidence.sh hospital-ransomware
```

It is fully synthetic: no real malware runs, nothing is truly encrypted (only
placeholder `.locked` files are written), and the destructive steps only touch
the lab directories the script creates (`/srv/hospital-data`, `/srv/backups`).
The stolen-credential login marker uses `198.51.100.23` (TEST-NET-2). The ground
truth is written to `/root/gemma-ir-ransomware-ground-truth.json`; treat it the
same way as the first scenario. `cleanup-scenario.sh` removes both scenarios.

The offline counterpart lives at `eval/fixtures/hospital-ransomware/` and drives
the tests and dashboard without a VM:

```bash
./scripts/run-demo.sh eval/fixtures/hospital-ransomware --serve
```

## Public-facing webshell and confirmed-exfiltration scenario

`run-webshell-scenario.sh` models a third, independent incident:

1. a crafted PACS upload is accepted by the public application (T1190);
2. an inert webshell marker runs in the `www-data` context (T1505.003);
3. `www-data` abuses a deliberately unsafe `sudo` rule (T1548.003);
4. the attacker installs cron persistence (T1053.003);
5. PACS credentials and synthetic study metadata are collected and staged;
6. a real HTTP transfer completes to a TEST-NET endpoint confined to the lab.

The receiver emits `proxy/egress.log` as an independent telemetry source, so
`assess_exfiltration` can require corroboration before returning `confirmed`.
The webshell file is inert and all transferred records are synthetic.

```bash
./scripts/run-victim-lab.sh webshell
./scripts/run-demo.sh eval/fixtures/hospital-webshell --serve
```

## Reproducible unattended installation

The current `Gemma IR Victim` VM was installed from the verified Ubuntu Server
24.04.4 ARM64 ISO with the NoCloud profile under `vm/autoinstall/`. The profile
creates:

- hostname `pacs-prod-01`;
- administrator `iradmin`;
- OpenSSH plus the local operator's public key;
- `auditd`, `jq`, `qemu-guest-agent`, and `zstd`;
- `/etc/gemma-ir-lab/authorized`, which the harmless scenario requires.

For a clean reinstall, serve that directory to the temporary shared network:

```bash
cd vm/autoinstall
python3 -m http.server 3003 --bind 0.0.0.0
```

At the Ubuntu ISO GRUB screen, append this to the `linux` line (the semicolon
must be escaped in GRUB):

```text
autoinstall ds=nocloud-net\;s=http://192.168.64.1:3003/
```

After installation, remove the CD drive or eject the ISO before the final boot.
