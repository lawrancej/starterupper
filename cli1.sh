#!/bin/bash

# Command-line interactive functions
# ---------------------------------------------------------------------

Interactive_paste() {
    local text="$1"; shift
    local prompt="$1"
    # If we cannot paste to the clipboard, ask the user
    if [[ ! $(Utility_paste "$text") ]]; then
        printf "Copy/paste $prompt:\n$text\n"
    # On a Mac, it's Command V
    elif [[ $OSTYPE == darwin* ]]; then
        printf "Paste $prompt with Cmd-V or right click."
    # Elsewhere, it's Ctrl-V
    else
        printf "Paste $prompt with Ctrl-V or right click."
    fi
}

# Cross platform file open
Interactive_fileOpen() {
    read < /dev/tty
    if [[ ! $(Utility_fileOpen "$1") ]]; then
        echo "Please open $1"
    else
        echo "Opening $1"
    fi
    read -p "Press enter to continue." < /dev/tty
    echo
}

# Ask the user to confirm whether the auto-detected value is correct.
Interactive_confirm() {
    local value="$1"; shift
    local isValid="$1"; shift
    local prompt="$1";
    local yn='';
    
    # As long as the supplied value is valid, ...
    while [[ $("$isValid" "$value") ]]; do
        # Ask the user to confirm it's okay
	
        read -t 5 -p "Hello $value.  (If you are someone else, press "n" within 10 seconds ) " yn < /dev/tty
        case "$yn" in
            # If the user's fine with it, we're done. Yay!
            [Yy] | [Yy][Ee][Ss] | "" ) return 0 ;;
            # If the user's not okay with it, we're done. Dang!
            [Nn] | [Nn][Oo] ) return 1 ;;
            # If the user's a goober, remind them what to do
            * ) echo "Please answer yes or no." ;;
        esac
    done
    # If the supplied value was invalid to begin with, indicate failure
    Utility_fail
}

# Ask the user to set the value
Interactive_setValue() {
    local key="$1"; shift
    local value="$1"; shift
    local isValid="$1"; shift
    local prompt="$1"; shift
    local invalid="$1"; 
    
    # First, ask the user to confirm if the value we auto-guessed is valid
    Interactive_confirm "$value" "$isValid" "$prompt"
    
    # If the user wasn't okay with the default value, ask for the right one.
    if [[ ! $(Utility_lastSuccess) ]]; then
        # The user didn't like the value or it was invalid to begin with
        value=""
        # So, as long as the value is bogus, ...
        while [[ ! $("$isValid" "$value") ]]; do
            # Ask for the right value
            read -p "Enter your $prompt: " value < /dev/tty
            # But, don't assume the user knows what they're doing
            if [[ ! $("$isValid" "$value") ]]; then
                echo -e "\e[1;37;41mERROR\e[0m: '$value' is not a $prompt. $invalid"
            fi
        done
        # By now, the user entered something that is at least plausible
    fi
    
    # Finally, set the key
    git config --global $key "$value"
}

# Interactively setup user information
User_setup() {
    Interactive_setValue "user.name" "$(User_getFullName)" "Valid_fullName" "full name" "Include your first and last name."
    Interactive_setValue "user.email" "$(User_getEmail)" "Valid_email" "school email address" "Use your .edu address."
}
