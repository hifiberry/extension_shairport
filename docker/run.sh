#!/bin/sh
echo "Starting nqptp"
/usr/local/bin/nqptp &
echo "Starting shairport-sync"
/usr/local/bin/shairport-sync -v
