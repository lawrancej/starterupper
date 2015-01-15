#!/bin/bash

# Configuration
# ---------------------------------------------------------------------

# The repository to clone as upstream (NO SPACES)
readonly REPO=starterupper
# Default domain for school email
readonly SCHOOL=wit.edu
# The instructor's Github username
readonly INSTRUCTOR_GITHUB=lawrancej

# Runtime flags (DO NOT CHANGE)
# ---------------------------------------------------------------------
readonly PROGNAME=$(basename $0)
readonly ARGS="$@"

# Non-interactive Functions
# ---------------------------------------------------------------------

# Utilities
# ---------------------------------------------------------------------

# Print out the size of the file
utility::fileSize() {
    local file="$1"
    local theSize="$(wc -c "$file" | awk '{print $1}' )"
    if [[ -z "$theSize" ]]; then
        theSize="0"
    fi
    printf "$theSize"
}

# "return" failure
utility::fail() {
    echo -n
    return 1
}

# "return" success
utility::success() {
    printf true
    return 0
}

# Return whether the last command was successful
utility::lastSuccess() {
    if [[ $? -eq 0 ]]; then
        utility::success
    else
        utility::fail
    fi
}

utility::asTrueFalse() {
    local result="$1"
    if [[ "$result" ]]; then
        printf "true"
    else
        printf "false"
    fi
}

PIPES=""

pipe::rm() {
    rm -f $PIPES 2> /dev/null
}

trap pipe::rm EXIT

# Make a named pipe. It sniffs for mkfifo and mknod first. If we don't get a real pipe, just fake it with a regular file.
pipe::new() {
    local pipe="$1"
    rm -f "$pipe" 2> /dev/null
    # Attempt to make a pipe
    if [[ -n "$(which mkfifo)" ]]; then
        mkfifo "$pipe" 2> /dev/null
    elif [[ -n "$(which mknod)" ]]; then
        mknod "$pipe" p 2> /dev/null
    fi
    # If nothing's there, just fake it with regular files
    if [[ ! -p "$pipe" ]]; then
        touch "$pipe"
    fi
    PIPES="$PIPES $pipe"
}

# Wait until we get the pipe
pipe::await() {
    local pipe="$1"
    until [[ -p "$pipe" ]] || [[ -f "$pipe" ]]; do
        sleep 1
    done
}

# Cross-platform read from named pipe
pipe::write() {
    local pipe="$1"; shift
    local data="$1"
    # We use echo here so we can send multi-line strings on one line
    echo "$data" > "$pipe"
    # If we got a real pipe, the pipe will wait, but if we got a fake pipe, ...
    if [[ ! -p "$pipe" ]]; then
        # We need to wait for the other side to read
        while [[ -s "$pipe" ]]; do
            sleep 1
        done
    fi
}

# Cross-platform read from named pipe
pipe::read() {
    local pipe="$1"
    local line=""
    # If we got a real pipe, read will block until data comes in
    if [[ -p "$pipe" ]]; then
        # Hooray for blocking reads
        read -r line < "$pipe"
        echo -e "$line"
    # Windows users can't have nice things, as usual...
    elif [[ -f "$pipe" ]]; then
        # Wait for the other side to write
        while [[ ! -s "$pipe" ]]; do
            sleep 1
        done
        read -r line < "$pipe"
        # Remove the line that we just read, because we've got to fake it
        sed -i -e "1d" "$pipe"
        echo -e "$line"
    fi
}

# Get the MIME type by the extension
utility::MIMEType() {
    local fileName="$1";
    case $fileName in
        *.html | *.htm ) printf "text/html" ;;
        *.ico ) printf "image/x-icon" ;;
        *.css ) printf "text/css" ;;
        *.js ) printf "text/javascript" ;;
        *.txt ) printf "text/plain" ;;
        *.jpg ) printf "image/jpeg" ;;
        *.png ) printf "image/png" ;;
        *.svg ) printf "image/svg+xml" ;;
        *.pdf ) printf "application/pdf" ;;
        *.json ) printf "application/json" ;;
        * ) printf "application/octet-stream" ;;
    esac
}

# Cross-platform paste to clipboard
utility::paste() {
    case $OSTYPE in
        msys | cygwin ) echo "$1" > /dev/clipboard ;;
        linux* | bsd* ) echo "$1" | xclip -selection clipboard ;;
        darwin* ) echo "$1" | pbcopy ;;
        *) return 1 ;;
    esac
}

# Cross-platform file open
utility::fileOpen() {
    case $OSTYPE in
        msys | cygwin ) start "$1" ;;
        linux* | bsd* ) xdg-open "$1" ;;
        darwin* ) open "$1" ;;
        *) return 1 ;;
    esac
}

# Validate nonempty value matches a regex
# Return success if the value is not empty and matches regex, fail otherwise
utility::nonEmptyValueMatchesRegex() {
    local value="$1"; shift
    local regex="$1"
    
    # First, check if value is empty
    if [[ -z "$value" ]]; then
        utility::fail
    # Then, check whether value matches regex
    elif [[ -z "$(echo "$value" | grep -E "$regex" )" ]]; then
        utility::fail
    else
        utility::success
    fi
}

# SSH
# ---------------------------------------------------------------------

# Configure our keypair and add known hosts keys
ssh::configure() {
    # Just in case they've never used SSH before...
    mkdir -p ~/.ssh
    touch ~/.ssh/known_hosts
    
    # If our public/private keypair doesn't exist, make it.
    if ! [[ -f ~/.ssh/id_rsa.pub ]]; then
        # Use default location, set no phassphrase, no questions asked
        printf "\n" | ssh-keygen -t rsa -N '' 2> /dev/null > /dev/null
    fi
    
    # Add known hosts (i.e., bitbucket.org, github.com, gitlab.com)
    ssh-keyscan -t rsa bitbucket.org github.com gitlab.com ssh.github.com \
    altssh.bitbucket.org 2>&1 | sort -u - ~/.ssh/known_hosts | uniq > ~/.ssh/tmp_hosts
    cat ~/.ssh/tmp_hosts >> ~/.ssh/known_hosts
}

# Get the user's public key
ssh::getPublicKey() {
    cat ~/.ssh/id_rsa.pub | sed s/==.*$/==/ # Ignore the trailing comment
}

ssh::getPublicKeyForSed() {
    ssh::getPublicKey | sed -e 's/[/]/\\\//g'
}

# Test connection
ssh::connected() {
    local hostDomain="$1"; shift
    local sshTest=$(ssh -oStrictHostKeyChecking=no git@$hostDomain 2>&1)
    if [[ 255 -eq $? ]]; then
        utility::fail
    else
        utility::success
    fi
}

# User functions
# ---------------------------------------------------------------------

# Get the user's username
user::getUsername() {
    local username="$USERNAME"
    if [[ -z "$username" ]]; then
        username="$(id -nu 2> /dev/null)"
    fi
    if [[ -z "$username" ]]; then
        username="$(whoami 2> /dev/null)"
    fi
    printf "$username"
}

# A full name needs a first and last name
valid::fullName() {
    local fullName="$1"
    utility::nonEmptyValueMatchesRegex "$fullName" "\w+ \w+"
}

# Set the full name, and return the name that was set
user::setFullName() {
    local fullName="$1"
    if [[ $(valid::fullName "$fullName") ]]; then
        if [[ "$fullName" != "The argument 'getfullname.ps1' to the -File parameter does not exist. Provide the path to an existing '.ps1' file as an argument to the -File parameter." ]]; then
            git config --global user.name "$fullName"
        fi
    fi
    git config --global user.name
}

# Get the user's full name (Firstname Lastname); defaults to OS-supplied full name
# Side effect: set ~/.gitconfig user.name if unset and full name from OS validates.
user::getFullName() {
    # First, look in the git configuration
    local fullName="$(git config --global user.name)"
    
    # Ask the OS for the user's full name, if it's not valid
    if [[ ! $(valid::fullName "$fullName") ]]; then
        local username="$(user::getUsername)"
        case $OSTYPE in
            msys | cygwin )
                cat << 'EOF' > getfullname.ps1
$MethodDefinition = @'
[DllImport("secur32.dll", CharSet=CharSet.Auto, SetLastError=true)]
public static extern int GetUserNameEx (int nameFormat, System.Text.StringBuilder userName, ref uint userNameSize);
'@
$windows = Add-Type -MemberDefinition $MethodDefinition -Name 'Secur32' -Namespace 'Win32' -PassThru
$sb = New-Object System.Text.StringBuilder
$num=[uint32]256
$windows::GetUserNameEx(3, $sb, [ref]$num) | out-null
$sb.ToString()
EOF
                fullName=$(powershell -executionpolicy remotesigned -File getfullname.ps1 | sed -e 's/\(.*\), \(.*\)/\2 \1/')
                rm getfullname.ps1 > /dev/null
                ;;
            linux* )
                fullName=$(getent passwd "$username" | cut -d ':' -f 5 | cut -d ',' -f 1)
                ;;
            darwin* )
                fullName=$(dscl . read /Users/`whoami` RealName | grep -v RealName | cut -c 2-)
                ;;
            *) fullName="" ;;
        esac
        
        # If we got a legit full name from the OS, update the git configuration to reflect it.
        user::setFullName "$fullName" > /dev/null
    fi
    printf "$fullName"
}

# We're assuming that students have a .edu email address
valid::email() {
    local email="$(printf "$1" | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
    utility::nonEmptyValueMatchesRegex "$email" "edu$"
}

# Get the user's email; defaults to username@school
# Side effect: set ~/.gitconfig user.email if unset
user::getEmail() {
    # Try to see if the user already stored the email address
    local email="$(git config --global user.email | tr '[:upper:]' '[:lower:]' | tr -d ' ')"
    # If the stored email is bogus, ...
    if [[ ! $(valid::email "$email") ]]; then
        # Guess an email address and save it
        email="$(user::getUsername)@$SCHOOL"
    fi
    # Resave, just in case of goofups
    git config --global user.email "$email"
    printf "$email"
}

# Set email for the user and return email stored in git
user::setEmail() {
    local email="$1"
    if [[ $(valid::email "$email") ]]; then
        git config --global user.email "$email"
    fi
    git config --global user.email
}

# Generic project host configuration functions
# ---------------------------------------------------------------------

# Get the project host username; defaults to machine username
Host_getUsername() {
    local host="$1"
    local username="$(git config --global $host.login)"
    if [[ -z "$username" ]]; then
        username="$(user::getUsername)"
    fi
    printf "$username"
}

# Git
# ---------------------------------------------------------------------

# Clone/fetch upstream
git::clone_upstream() {
    local host="$1"; shift
    local upstream="$1"
    pushd ~ > /dev/null
    if [[ ! -d $REPO ]]; then
        git clone "https://$host/$upstream/$REPO.git" > /dev/null
    else
        pushd $REPO > /dev/null
        git fetch --all > /dev/null
        popd > /dev/null
    fi
    utility::fileOpen $REPO
    popd > /dev/null
}

# Configure remotes
git::configure_remotes() {
    local hostDomain="$1"; shift
    local originLogin="$1"; shift
    local upstreamLogin="$1";
    local origin="git@$hostDomain:$originLogin/$REPO.git"
    local upstream="https://$hostDomain/$upstreamLogin/$REPO.git"
    
    # Configure remotes
    cd ~/$REPO
    git remote rm origin 2> /dev/null
    git remote rm upstream 2> /dev/null
    git remote add origin "$origin"
    git remote add upstream "$upstream"
    git config branch.master.remote origin
    git config branch.master.merge refs/heads/master
    git remote | tr '\n' ' '
}

# Push repository, and show the user local/remote repositories
# Preconditions:
# 1. SSH public/private keypair was generated
# 2. The project host username was properly set
# 3. SSH public key was shared with host
# 4. SSH is working
# 5. SSH key is in known_hosts
# 6. The private repo exists
git::push() {
    cd ~/$REPO
    git push -u origin master 2> /dev/null > /dev/null
    utility::lastSuccess
}

# http://mywiki.wooledge.org/NamedPipes
# Also, simultaneous connections

json::unpack() {
    local json="$1"
    echo "$json" | tr -d '"{}' | tr ',' '\n'
}

# Given a header key, return the value
json::lookup() {
    local json="$1"; shift
    local key="$1"
    echo -e "$json" | grep "$key" | sed -e "s/^$key:\(.*\)$/\1/"
}

# Is this a request line?
request::line() {
    local line="$1"
    if [[ -z "$(echo "$line" | grep -E "^GET|^HEAD|^POST|^PUT|^DELETE|^CONNECT|^OPTIONS|^TRACE")" ]]; then
        utility::fail
    fi
    utility::success
}

# Get the method (e.g., GET, POST) of the request
request::method() {
    local request="$1"
    echo "$request" | sed -e "s/\(^[^ ]*\).*/\1/" | head -n 1
}

# Get the target (URL) of the request
request::target() {
    local request="$1"
    echo "$request" | sed -e 's/^[^ ]* \(.*\) HTTP\/.*/\1/' | head -n 1
}

# Get the file from the request target URL
request::file() {
    local request="$1"
    local target="$(request::target "$request")"
    # Leave the root request alone
    if [[ "$target" == "/" ]]; then
        printf "/"
    # Remove attempts to look outside the current folder, strip off the leading slash and the query
    else
        printf "$target" | sed -e 's/[.][.]//g' -e 's/^[/]*//g' -e 's/[?].*$//'
    fi
}

# Get the query portion of the request target URL, and return the results line by line
request::query() {
    request::target "$1" | sed -e 's/.*[?]\(.*\)$/\1/' | tr '&' '\n'
}

# Parse the request payload as form-urlencoded data
request::post_form_data() {
    local request="$1"
    local payload="$(request::payload "$request")"
    echo -e "REQUEST $request" >&2
    if [[ "$(request::lookup "$request" "Content-Type")" == "application/x-www-form-urlencoded" ]]; then
        echo "$payload" | tr '&' '\n'
    fi
}

# Given a query key, return the URL decoded value
query::lookup() {
    local query="$1"; shift
    local key="$1"
    echo -e "$(printf "$query" | grep "$key" | sed -e "s/^$key=\(.*\)/\1/" -e 'y/+/ /; s/%/\\x/g')"
}

# Return the key corresponding to the field
parameter::key() {
    local parameter="$1"
    echo "$parameter" | cut -d '=' -f 1
}

# Return the URL decoded value corresponding to the field
parameter::value() {
    local parameter="$1"
    echo -e "$(echo "$parameter" | cut -d '=' -f 2 | sed 'y/+/ /; s/%/\\x/g')"
}

# Given a header key, return the value
request::lookup() {
    local request="$1"; shift
    local key="$1"
    echo -e "$request" | grep "$key" | sed -e "s/^$key: \(.*\)/\1/"
}

# Return the payload of the request, if any (e.g., for POST requests)
request::payload() {
    local request="$1"; shift
    echo -e "$request" | sed -n -e '/^$/,${p}'
}

# Pipe HTTP request into a string
request::new() {
    local line="$1"
    # If we got a request, ...
    if [[ $(request::line "$line") ]]; then
        local request="$line"
        # Read all headers
        while read -r header; do
            request="$request\n$header"
            if [[ -z "$header" ]]; then
                break
            fi
        done
        # Sometimes, we have a payload in the request, so handle that, too...
        local length="$(request::lookup "$request" "Content-Length")"
        local payload=""
        if [[ -n "$length" ]] && [[ "$length" != "0" ]]; then
            read -r -n "$length" payload
            request="$request\n$payload"
        fi
    fi
    # Return single line string
    echo "$request"
}

# Build a new response
response::new() {
    local status="$1"
    echo "HTTP/1.1 $status\r\nDate: $(date '+%a, %d %b %Y %T %Z')\r\nServer: Starter Upper"
}

# Add a header to the response
response::add_header() {
    local response="$1"; shift
    local header="$1";
    echo "$response\r\n$header"
}

# Add headers to response assuming file is payload
response::add_file_headers() {
    local response="$1"; shift
    local file="$1"
    response="$response\r\nContent-Length: $(utility::fileSize "$file")"
    response="$response\r\nContent-Encoding: binary"
    response="$response\r\nContent-Type: $(utility::MIMEType $file)"
    echo "$response"
}

# Add headers to response assuming string is payload
response::add_string_headers() {
    local response="$1"; shift
    local str="$1"; shift
    local type="$1"
    response="$response\r\nContent-Length: ${#str}"
    response="$response\r\nContent-Type: $type"
    echo "$response"
}

# "Send" the response headers
response::send() {
    echo -ne "$1\r\n\r\n"
}

# Send file with HTTP response headers
server::send_file() {
    local file="$1";
    if [[ -z "$file" ]]; then
        return 0
    fi
    local response="$(response::new "200 OK")"
    if [[ ! -f "$file" ]]; then
        response="$(response::new "404 Not Found")"
        file="404.html"
    fi
    response="$(response::add_file_headers "$response" "$file")"
    response::send "$response"
    cat "$file"
    echo "SENT $file" >&2
}

# Send string with HTTP response headers
server::send_string() {
    local str="$1"; shift
    local type="$1"; shift
    local response="$(response::new "200 OK")"
    response="$(response::add_string_headers "$response" "$str" "$(utility::MIMEType $type)")"
    response="$response\r\nAccess-Control-Allow-Origin: *"
    response::send "$response"
    echo "$str"
}

# Listen for requests
server::listen() {
    local request=""
    while read -r line; do
        request=$(request::new "$line")
        # Send the request through 
        pipe::write "$PIPE" "$request\n"
    done
}

# Respond to requests, using supplied route function
# The route function is a command that takes a request argument: it should send a response
server::respond() {
    local routeFunction="$1"
    local request=""
    pipe::await "$PIPE"
    while true; do
        request="$(pipe::read "$PIPE")"
        # Pass the request to the route function
        "$routeFunction" "$request"
    done
}

server::get_netcat() {
    local netcat=""
    # Look for netcat
    for program in "nc" "ncat" "netcat"; do
        if [[ -n "$(which $program)" ]]; then
            netcat=$program
            break
        fi
    done
    # Get netcat, if it's not already installed
    if [[ -z "$netcat" ]]; then
        curl http://nmap.org/dist/ncat-portable-5.59BETA1.zip 2> /dev/null > ncat.zip
        unzip -p ncat.zip ncat-portable-5.59BETA1/ncat.exe > nc.exe
        netcat="nc"
        rm ncat.zip
    fi
    printf $netcat
}

readonly PIPE=.httpipe

# Start the web server, using the supplied routing function
server::start() {
    local routes="$1"
    pipe::new "$PIPE"
    local nc=$(server::get_netcat)
    
    server::respond "$routes" | "$nc" -k -l 8080 | server::listen
}


# Github non-interactive functions
# ---------------------------------------------------------------------

# Set github login and print it back out
github::set_login() {
    local login="$1"
    if [[ $(github::validUsername "$login") ]]; then
        git config --global github.login "$login"
    fi
    git config --global github.login
}

# Helpers

# Invoke a Github API method requiring authorization using curl
github::invoke() {
    local method=$1; shift
    local url=$1; shift
    local data=$1;
    local header="Authorization: token $(git config --global github.token)"
    curl -i --request "$method" -H "$header" -d "$data" "https://api.github.com$url" 2> /dev/null
}

# Queries

# Is the name available on Github?
github::nameAvailable() {
    local username="$1"
    local result="$(curl -i https://api.github.com/users/$username 2> /dev/null)"
    if [[ -z $(echo $result | grep "HTTP/1.1 200 OK") ]]; then
        utility::success
    else
        utility::fail
    fi
}

# A valid Github username is not available, by definition
github::validUsername() {
    local username="$1"
    # If the name is legit, ...
    if [[ $(utility::nonEmptyValueMatchesRegex "$username" "^[0-9a-zA-Z][0-9a-zA-Z-]*$") ]]; then
        # It's valid
        utility::success
    else
        # Otherwise, it's not valid
        utility::fail
    fi
}

# Commands

# Github CLI-interactive functions
# ---------------------------------------------------------------------

# Share the public key
# Fail if the key isn't shared or we can't connect.
github::connected() {
    local githubLogin="$(Host_getUsername "github")"
    # Check if public key is shared
    local publickeyShared=$(curl -i https://api.github.com/users/$githubLogin/keys 2> /dev/null)
    # If not shared, share it
    if [[ -z $(echo "$publickeyShared" | grep $(ssh::getPublicKey | sed -e 's/ssh-rsa \(.*\)=.*/\1/')) ]]; then
        return 1
    fi
    # Test SSH connection on default port (22)
    if [[ ! $(ssh::connected "github.com") ]]; then
        printf "Host github.com\n  Hostname ssh.github.com\n  Port 443\n" >> ~/.ssh/config
        # Test SSH connection on port 443
        if [[ ! $(ssh::connected "github.com") ]]; then
            return 1
        fi
    fi
    return 0
}

# Add collaborators (move to web front-end)
github::addCollaborators() {
    cd ~/$REPO
    for repository in $(github::invoke GET "/user/repos?type=member\&sort=created\&page=1\&per_page=100" "" | grep "full_name.*$REPO" | sed s/.*full_name....// | sed s/..$//); do
        git remote add ${repository%/*} git@github.com:$repository.git 2> /dev/null
    done
    git fetch --all
}

# Make the index page
app::make_index() {

    curl http://lawrancej.github.io/starterupper/index.html 2> /dev/null > $REPO-index.html 
#    cp ~/projects/starterupper/index.html $REPO-index.html

    sed -e "s/REPOSITORY/$REPO/g" \
    -e "s/USER_EMAIL/$(user::getEmail)/g" \
    -e "s/FULL_NAME/$(user::getFullName)/g" \
    -e "s/USER_NAME/$(user::getUsername)/g" \
    -e "s/INSTRUCTOR_GITHUB/$INSTRUCTOR_GITHUB/g" \
    -e "s/PUBLIC_KEY/$(ssh::getPublicKeyForSed)/g" \
    -e "s/HOSTNAME/$(hostname)/g" \
    $REPO-index.html > temp.html
    rm "$REPO-index.html"
}

app::index() {
    local request="$1"
    
    echo "$(request::payload "$request")" >&2
#    printf "$(request::query "$request")" >&2
    
    request::post_form_data "$request" | while read parameter; do
        local key="$(parameter::key "$parameter")"
        local value="$(parameter::value "$parameter")"
        case "$key" in
            "user.name" )
                user::setFullName "$value" > /dev/null
                ;;
            "user.email" )
                user::setEmail "$value" > /dev/null
                ;;
            "github.login" )
                github::set_login "$value" > /dev/null
                ;;
        esac
    done
    
    git::configure_remotes "github.com" "$(git config --global github.login)" "$INSTRUCTOR_GITHUB" > /dev/null
    git::push > /dev/null
    
    app::make_index
    server::send_file "temp.html"
}

# Return the browser to the browser for disabled JavaScript troubleshooting
app::browser() {
    local request="$1"
    local agent="$(request::lookup "$request" "User-Agent")"
    case "$agent" in
        *MSIE* | *Trident* )
            server::send_string ".firefox, .chrome {display: none;}" "browser.css" ;;
        *Firefox* )
            server::send_string ".chrome, .msie {display: none;}" "browser.css" ;;
        *Chrome* )
            server::send_string ".firefox, .msie {display: none;}" "browser.css" ;;
    esac
}

# Setup local repositories
app::setup() {
    local request="$1"
    local response=""
    case "$(request::method "$request")" in
        # Respond to preflight request
        "OPTIONS" )
            printf "Sending preflight..." >&2
            response="$(response::new "204 No Content")"
            response="$(response::add_header "$response" "Access-Control-Allow-Origin: *")"
            response="$(response::add_header "$response" "Access-Control-Allow-Methods: GET, POST")"
            response="$(response::add_header "$response" "Access-Control-Allow-Headers: $(request::lookup "$request" "Access-Control-Request-Headers")")"
            response::send "$response"
            echo -e "                                                       [\e[1;32mOK\e[0m]" >&2
            ;;
        # Get that glorious data from the user and do what we set out to accomplish
        "POST" )
            printf "Responding to request..." >&2
            local data="$(json::unpack "$(request::payload "$request")")"
            local github_login="$(json::lookup "$data" "github.login")"
            local user_name="$(json::lookup "$data" "user.name")"
            local user_email="$(json::lookup "$data" "user.email")"
            # Git configuration
            
            read -r -d '' response <<-EOF
{
    "name": "$(user::setFullName "$user_name")",
    "email": "$(user::setEmail "$user_email")",
    "github": "$(github::set_login "$github_login")",
    "clone": true,
    "remotes": "$(git::configure_remotes "github.com" "$(git config --global github.login)" "$INSTRUCTOR_GITHUB")",
    "push": $(utility::asTrueFalse $(git::push))
}
EOF
            # The response needs to set variables: name, email, git-clone, git-push
            server::send_string "$response" "response.json"
            echo -e "                                                   [\e[1;32mOK\e[0m]" >&2
            ;;
        # If we get here, something terribly wrong has happened...
        * )
            return 1
            ;;
    esac
}

# Dummy response to verify server works
app::test() {
    local request="$1"
    server::send_string "true" "application/json"
}

# Handle requests from the browser
app::router() {
    local request="$1"
    local target="$(request::file "$request")"
    case "$target" in
        "/" )           app::index "$request" ;;
        "test" )        app::test "$request" ;;
        "browser.css" ) app::browser "$request" ;;
        "setup" )       app::setup "$request" ;;
        * )             server::send_file "$target"
    esac
}

app::url() {
    printf "file://$(pwd | sed -e "s/^\\/c/\\/c:/")/temp.html"
}

main() {
    # Go into the home directory
    pushd ~ > /dev/null
    
    # Make web page
    printf "Please wait, gathering information..."
    ssh::configure
    app::make_index
    echo -e "                                      [\e[1;32mOK\e[0m]"
    
    # Clone upstream
    echo "Cloning upstream..."
    git::clone_upstream "github.com" "$INSTRUCTOR_GITHUB"
    echo -e "                                                                           [\e[1;32mOK\e[0m]"

    # Open setup page
    utility::paste "$(app::url)"
    echo "Opening $(app::url) in a web browser."
    utility::fileOpen temp.html

    echo -e "Starting local web server at http://localhost:8080...                      [\e[1;32mOK\e[0m]"
    server::start "app::router"
    
    # Go back where we were
    popd > /dev/null
}

main
