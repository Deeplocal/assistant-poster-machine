#!/bin/bash

echo "Configuring /home/pi/.asoundrc"

# 9 should never be valid, should always be replaced
let micCard=9
let speakerCard=9

# pipe record devices into while loop line-by-line
while read line; do

  # if line contains correct audio device
  if [[ $line == *"Shure Digital"* ]]; then
    echo Found $line
    let micCard=$(echo $line | cut -d ' ' -f 2 | cut -d ':' -f 1)
    break
  fi
done < <(arecord -l)

# print mic card
echo Mic card $micCard

# pipe play devices into while loop line-by-line
while read line; do

  # if line contains correct audio device
  if [[ $line == *"USB Audio Device"* ]]; then
    echo Found $line
    let speakerCard=$(echo $line | cut -d ' ' -f 2 | cut -d ':' -f 1)
    break
  fi
done < <(aplay -l)

# print speaker card
echo Speaker card $speakerCard

# overwrite current .asoundrc file with new values
sed -i.tmp -e "9 s/hw:.,./hw:$micCard,0/" /home/pi/.asoundrc # for mic
sed -i.tmp -e "15 s/hw:.,./hw:$speakerCard,0/" /home/pi/.asoundrc # for speaker

echo "Successfully configured /home/pi/.asoundrc"
