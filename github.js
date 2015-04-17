// Quick and dirty Github Javascript API wrapper

// Workarounds for legacy browsers
// Courtesy: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
if ( !Date.prototype.toISOString ) {
  ( function() {
    function pad(number) {
      var r = String(number);
      if ( r.length === 1 ) {
        r = '0' + r;
      }
      return r;
    }
    Date.prototype.toISOString = function() {
      return this.getUTCFullYear()
        + '-' + pad( this.getUTCMonth() + 1 )
        + '-' + pad( this.getUTCDate() )
        + 'T' + pad( this.getUTCHours() )
        + ':' + pad( this.getUTCMinutes() )
        + ':' + pad( this.getUTCSeconds() )
        + '.' + String( (this.getUTCMilliseconds()/1000).toFixed(3) ).slice( 2, 5 )
        + 'Z';
    };
  }() );
}

// btoa (worry about this) IE10+ 
// see: https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_.22Unicode_Problem.22

// Methods with an object parameter often require two callbacks in an object:
// success and fail.
var Github = {
    // Innocent until proven guilty properties
    badCredentials: false,
    setOTP: false,
    upgraded: false,
    emailVerified: false,
    nameShared: false,
    keyShared: false,
    repoCreated: false,
    
    // Use email to authenticate (because nobody remembers their username)
    email: "",
    // Self-explanatory
    password: "",
    // One Time Password for Two-factor authentication
    otp: "",
    
    // Collaborator set (a map of collaborators names to themselves)
    collaborators : {},
    
    // Are we signed in?
    authenticated: function () {
        return localStorage.hasOwnProperty("Github.token") && localStorage.hasOwnProperty("Github.username");
    },
    // Internal: used by API invoker
    getAuthorization: function () {
        if (localStorage.hasOwnProperty("Github.token")) {
            return "token " + localStorage.getItem("Github.token");
        } else {
            return "Basic " + btoa(Github.email + ":" + Github.password)
        }
    },
    // Return the Github user name
    getUsername: function() { return localStorage.getItem("Github.username"); },
    // Is the user already already a user?
    existingUser: function() { return localStorage.hasOwnProperty("Github.username"); },
    
    repoURL: function() { return "https://github.com/" + Github.getUsername() + "/" + model.repo(); },

    // Generic Github API invoker (used internally)
    invoke: function (settings) {
        var request = {
            crossDomain: true,
            url: "https://api.github.com" + settings.url,
            type: settings.method,
            beforeSend: function(xhr) {
                xhr.setRequestHeader("Authorization", Github.getAuthorization());
                xhr.setRequestHeader("Content-Type", "application/json");
                if (Github.setOTP) {
                    xhr.setRequestHeader("X-Github-OTP", Github.otp);
                    // It is one time, after all
                    Github.setOTP=false;
                }
            },
            contentType: ("wwwForm" in settings) ? 'application/x-www-form-urlencoded; charset=UTF-8' : "application/json",
            dataType: "json",
            processData: ("wwwForm" in settings),
            success: settings.success,
            error: settings.fail
        }
        if (JSON.stringify(settings.data) !== "{}" && request.contentType === "application/json") {
            request.data = JSON.stringify(settings.data);
        } else if (request.contentType !== "application/json") {
            request.data = settings.data;
        }
        $.ajax(request);
    },

    // Login to Github given object with username, password, otp, and 
    // function callbacks: authenticated, badCredential, twoFactor
    login: function (settings) {
        // username could be the email or Github username
        Github.email = settings.username;
        Github.password = settings.password;
        Github.otp = settings.otp;
        var date = new Date();
        if (Github.authenticated()) {
            settings.authenticated();
        } else {
            Github.invoke({
                url: "/authorizations",
                method: "POST",
                data: {
                    scopes: ["repo","public_repo","user","write:public_key","user:email"],
                    note: "starterupper " + date.toISOString()
                },
                success: function (data) {
                    Github.badCredentials = false;
                    localStorage.setItem("Github.token", data.token);
                    Github.getUser({
                        success: function (response) {
                            localStorage.setItem("Github.username", response.login);
                            settings.authenticated();
                        }
                    });
                },
                fail: function (response) {
                    if (response.status == 401) {
                        // We should be looking at the response headers instead, probably: response.getResponseHeader('some_header')
                        if (response.responseJSON.message == "Bad credentials") {
                            Github.badCredentials = true;
                            settings.badCredential();
                        } else if (response.responseJSON.message == "Must specify two-factor authentication OTP code.") {
                            Github.setOTP = true;
                            settings.twoFactor();
                        }
                    }
                }
            });
        }
    },
    
    // Logout of Github
    logout: function() {
        localStorage.removeItem('Github.token');
    },
    
    // Get email configuration given object with fields: email, verified, fail
    // verified is function(bool)
    getEmail: function(settings) {
        Github.invoke({
            url: "/user/emails", method: "GET", data: {},
            success: function (response) {
                for (index in response) {
                    if (response[index].email == settings.email) {
                        settings.success(response[index].verified);
                        return;
                    }
                }
            },
        });
    },
    
    // Get user name given object with fields: success, fail
    getUser: function(settings) {
        Github.invoke({
            url: "/user",
            method: "GET",
            data: {},
            success: settings.success,
            fail: settings.fail
        });
    },
    
    // Set user name given object with fields: data, success, fail
    setUser: function(settings) {
        Github.invoke({
            url: "/user",
            method: "PATCH",
            data: settings.data,
            success: settings.success,
            fail: settings.fail
        });
    },
    
    // Share key given object with fields: key, title, success, fail
    shareKey: function(settings) {
        if (!user.key.isValid()) return;
        Github.invoke({
            url: "/user/keys",
            method: "GET",
            data: {},
            success: function(response) {
                for (index in response) {
                    if (response[index].key == settings.key) {
                        settings.success(response);
                        return;
                    }
                }
                // Send key
                Github.invoke({
                    url: "/user/keys",
                    method: "POST",
                    data: {
                        title: settings.title,
                        key: settings.key
                    },
                    success: settings.success,
                    fail: settings.fail
                });
            },
            fail: settings.fail
        });
    },

    // Perform all account setup steps given object with:
    // key: share the SSH key
    // title: the SSH key's title
    // name: share the user's full name
    // email: check it is verified
    // callback: function(key, boolean) to update view
    setupAccount: function(settings) {
        // Onboarding/authentication status
        settings.callback("github-onboard", !Github.existingUser());
        settings.callback('github-authenticated', Github.authenticated());
    
        if (Github.authenticated()) {
            // Nag the user if they're not on an upgraded plan
            if (!Github.upgraded) { 
                Github.getUser({
                    success: function(response) {
                        Github.upgraded = response.plan.name.toLowerCase() != "free";
                        settings.callback('github-upgraded', Github.upgraded);
                    }
                });
            }
            // Set their profile information
            if (!Github.nameShared) {
                Github.setUser({
                    data: { name: settings.name },
                    success: function(response) {
                        Github.nameShared = true;
                        settings.callback('github-profile',true);
                    },
                });
            }
            // Confirm email is verified
            if (!Github.emailVerified) {
                Github.getEmail({
                    email: settings.email,
                    success: function(response) {
                        Github.emailVerified = response;
                        settings.callback('github-email-verified',response);
                    }
                });
            }
            // Share key
            if (!Github.keyShared) {
                Github.shareKey({
                    title: settings.title,
                    key: settings.key,
                    success: function() {
                        Github.keyShared = true;
                        settings.callback('github-key',true);
                    },
                });
            }
            // Setup repository
            if (!Github.repoCreated) {
                Github.setupRepo(settings);
            }
        }
    },

    // Create repository given object with success and fail callbacks.
    createRepo: function(settings) {
        var url = "/repos/" + Github.getUsername() + "/" + model.repo();
        if (Github.authenticated()) {
            Github.invoke({
                method: "GET", url: url, data: {},
                // If the repo is created already, we're done
                success: settings.success,
                // Otherwise, we need to make it
                fail: function(response) {
                    Github.invoke({
                        method: "POST", url: "/user/repos",
                        data: { name: model.repo() },
                        success: settings.success,
                        fail: settings.fail,
                    });
                }
            });
        }
    },
    
    // Make repository private given object with success and fail callbacks
    privateRepo: function(settings) {
        var url = "/repos/" + Github.getUsername() + "/" + model.repo();
        Github.invoke({
            method: "PATCH", url: url,
            data: { name: model.repo(), "private": true },
            success: settings.success,
            fail: settings.fail
        });
    },

    // Add collaborator given object with a collaborator string and success, fail callbacks.
    addCollaborator: function(settings) {
        var url = "/repos/" + Github.getUsername() + "/" + model.repo() + "/collaborators/" + settings.collaborator;
        // If we have a collaborator already, great!
        Github.invoke({
            method: "GET", url: url, data: {},
            success: settings.success,
            // Otherwise, put the collaborator there
            fail: function() {
                Github.invoke({
                    method: "PUT", url: url, data: {},
                    success: settings.success,
                    fail: settings.fail
                });
            }
        });
    },
    
    // Populate collaborator set given object with a page integer and success, fail callbacks.
    getCollaborators: function(settings) {
        Github.invoke({
            method: "GET",
            url: "/user/repos",
            data: {
                "type" : "member",
                "sort" : "created",
                "page" : settings.page,
                "per_page" : 100,
            },
            success: function(response) {
                for (var i = 0; i < response.length; i++) {
                    if (response[i].name == model.repo()) {
                        if (response[i].owner.login in Github.collaborators) {
                            return;
                        }
                        Github.collaborators[response[i].owner.login] = response[i].owner.login;
                    }
                }
                if (response.length > 0) {
                    Github.getCollaborators({
                        page: settings.page + 1,
                        success: settings.success,
                        fail: settings.fail,
                    });
                } else {
                    settings.success(Github.collaborators);
                }
            },
            fail: settings.fail,
            wwwForm: true,
        });
    },

    // Create repository, add collaborator, and make private, given object with
    // callback function(key, bool) to update view
    setupRepo: function (settings) {
        Github.createRepo({
            success: function(response) {
                settings.callback('github-repository',true);
                Github.addCollaborator({
                    collaborator: model.instructor('github'),
                    success: function(response) {
                        settings.callback('github-collaborator', true);
                    },
                });
                // Make the repository private if we're not the instructor
                if (model.instructor('github') != Github.getUsername()) {
                    Github.privateRepo({
                        success: function(response) {
                            settings.callback('github-private', true);
                        },
                    });
                }
            },
        });
    }

}