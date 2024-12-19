#!/bin/sh

# File containing the configuration
CONFIG_FILE="/etc/shairport-sync.conf"

result=$(awk '
BEGIN {
    FS="=";
    section=0;
    found=0;
}

# Check for the start of the docker section
/docker[[:space:]]*=[[:space:]]*\{/ {
    section=1;
}

# Check if we are still in the section
/}/ {
    if (section) {
        section=0;
    }
}

# If we are in the section, check for airplay2 enabled
{
    if (section && tolower($0) ~ /airplay2[[:space:]]*=[[:space:]]*"yes"/) {
        found=1;
    }
}

END {
    if (found) {
        print "enabled";
    } else {
        print "not enabled";
    }
}' "$CONFIG_FILE")

echo "AirPlay 2 is $result."

echo "Starting nqptp"
/usr/local/bin/nqptp -v &
echo "Starting shairport-sync"

# Shairport-sync uses the binary name for additional processing,
# therefore we need to make sure it's always shairport-sync
if [ "$result" == "enabled" ]; then 
 BIN=/usr/local/bin/shairport-sync-2
else 
 BIN=/usr/local/bin/shairport-sync-classic
fi

RUNBIN=/tmp/bin/shairport-sync
mkdir -p /tmp/bin

if [ -f $RUNBIN ]; then
	rm $RUNBIN
fi
ln -s $BIN $RUNBIN
ls -l /tmp/bin/
$RUNBIN -v -c /etc/shairport-sync.conf

