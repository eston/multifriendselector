/**
 *  Twitter Multi-Friend Selector
 *  A jQuery-based multi-friend selector for Twitter friends.
 *
 *  By Eston Bond (eston@socialuxe.com)
 *  Copyright (c) 2009 Eston Bond.
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 *  @author eston
 *  @requires jquery
**/

(function($) {
  
  // class globals
  var $this = null;
  var options = null;
  var people = [];
  var selected = [];
  
  // making ID arrays to make searching faster at the expense of first load
  var ids_people = [];
  var ids_selected = [];
  var ids_excluded = [];

  // maintaining references to common elements
  var $form = null;
  var $friendsBox = null;
  var $loadingBox = null;
  var $selectedBox = null;
  var $selectedInput = null;

  // public:
  
  $.fn.multifriendselector = function(incomingOptions) {
    options = $.extend({}, $.fn.multifriendselector.defaultOptions, incomingOptions);
    $this = $(this);
    ids_excluded = options.exclude_ids;
    
    if (!options.id) {
      if (options.development_mode) {
        debug('Twitter MultiFriendSelector: No ID has been specified.');
      }
      return false;
    }
    
    // inject the layout here
    if (options.development_mode) {
      injectLayout($this);
    } else {
      $this.append($(composeLayout()));
      
      $form = $this.find('form.socialuxe-TwitterMFS');
      $friendsBox = $this.find('div.socialuxe-TwitterMFS-friends');
      $selectedBox = $this.find('div.socialuxe-TwitterMFS-friendsSelected');
      $loadingBox = $this.find('div.socialuxe-TwitterMFS-loading');
      $selectedInput = $this.find('input.socialuxe-TwitterMFS-selectedID');
      
      // attach events to links for toggling between boxes
      $this.find('a.socialuxe-TwitterMFS-friendsLink')
           .bind('click.twittermfs', handleFriendsLinkClick);

      $this.find('a.socialuxe-TwitterMFS-selectedLink')
           .bind('click.twittermfs', handleSelectedLinkClick);
           
      // inject skip link hrefs
      $this.find('a.socialuxe-TwitterMFS-skipLink').attr('href', options.bypass_url);
      
      // attach event for submission
      $form.attr('action', options.action_url);
      $form.bind('submit.twittermfs', handleFormSubmission);
    }
    $friendsBox = $this.find('div.socialuxe-TwitterMFS-friends');
    $selectedBox = $this.find('div.socialuxe-TwitterMFS-friendsSelected');
    $loadingBox = $this.find('div.socialuxe-TwitterMFS-loading');
    
    // we have an id, go ahead and get the proper data for the view present
    $.fn.multifriendselector.getData(options.id, options.friend_type,
       function() {
          populateFriendsBox();
       }); // end async
  }
  
  $.fn.multifriendselector.defaultOptions = {
    action_url: '/',
    actiontext: 'Select friends to invite',
    actiongraf: 'Select your friends to invite to this service.',
    async_post: true,
    async_post_url: null,
    async_post_redirect: '/',
    bypass: 'Skip',
    bypass_url: '/',
    development_mode: false,
    exclude_ids: [],
    friend_type: 'friends',
    id: null,
    limit: 100,
    mfs_id: '',
    post_action: '/'
  }
  
  $.fn.multifriendselector.getData = function(id, type, callback, page) {
    var endpoint = 'http://twitter.com/statuses/' + type + '/' + id + '.json?'
                 + 'callback=?';
    if (!callback) {
      callback = function() { };
    }
    if (!page) {
      page = 1;
    }
    $.getJSON(endpoint, function(data) {
                // push all received data to the selector
                if (data.length > 0) {
                  var limit = 100;
                  if (typeof options.limit != 'undefined') {
                    limit = options.limit;
                  }
                  var i = data.length;
                  do {
                    try {
                      if (people.length < limit) {
                        people.push(data[i-1]);
                        ids_people.push(data[i-1].id);
                      }
                    } catch (e) { }
                  } while (--i);
                }                
                if (people.length < limit && 
                    data.length > 0) {
                    // tail recursion is fun
                    $.fn.multifriendselector.getData(id, type, callback, page+1);
                } else {
                  callback();
                }
              });
  }
  
  $.fn.multifriendselector.postForm = function(idString, errorCallback) {
    var endpoint;
    if (options.async_post_url)  {
      endpoint = options.async_post_url;
    } else {
      endpoint = options.post_action;
    }
    
    if (typeof error_callback != 'function') {
      errorCallback = function() { }
    }
    var idString = $selectedInput.val();
    $.post(endpoint, {selected: idString},
           function(data, textStatus) {
             if (textStatus == 'success') {
               window.location.href = options.async_post_redirect;
             } else {
               errorCallback();
             }
           });
  }
  
  
  // private:
  /**
   *  Convenience Functions
   *  Convenience functions for array searches, debugging, &c.
  **/
  function array_find(needle, haystack) {
    if (haystack.length > 0) {
      var i = haystack.length;
      do {
        if (haystack[i-1] == needle) {
          return true;
        }
      } while (--i);
    }
    return false;
  }
  
  function array_remove(needle, haystack) {
    var position = null;
    if (haystack.length > 0) {
      var i = haystack.length;
      if (haystack[0] == needle) {
        position = 0;
      } else {
        do {
          if (haystack[i] == needle) {
            position = i;
          }
        } while (--i);
      }
    }
    if (position !== null) {
      haystack.splice(position, 1);
    }
  }
  
  function debug(mixed) {
    try {
      if (typeof console.log == 'function') {
        console.log(mixed);
      }
    }
    catch (e) { }
  }
  
  function userExists(id) {
    array_find(id, ids_people);
  }
  
  function userIsExcluded(id) {
    array_find(id, ids_excluded);
  }
  
  function userIsSelected(id) {
    array_find(id, ids_selected);
  }
  
  
  
  
  /**
   *  DOM Manipulation
   *  These functions manipulate DOM elements within the MultiFriendSelector.
  **/
  function populateFriendsBox() {
    if (people.length > 0) {
      var i = people.length;
      do {
        var element = composeUserBox(people[i-1]);
        $friendsBox.append(element);
        
        // attach onclick element to box
        $(element).bind('click.twittermfs', handleUserClick);
        
        // attach hover interactions to box
        $(element).bind('mouseenter.twittermfs', handleUserMouseEnter);
        $(element).bind('mouseleave.twittermfs', handleUserMouseLeave);
        
      }
      while (--i);
      $friendsBox.show();
      $loadingBox.hide();
      $this.find('span.socialuxe-TwitterMFS-populationCount')
           .html(people.length.toString());
    }
  }
  
  function injectLayout($into) {
    $into.load('../multifriendselector.html', {}, function() {
      $form = $this.find('form.socialuxe-TwitterMFS');
      $friendsBox = $this.find('div.socialuxe-TwitterMFS-friends');
      $selectedBox = $this.find('div.socialuxe-TwitterMFS-friendsSelected');
      $loadingBox = $this.find('div.socialuxe-TwitterMFS-loading');
      $selectedInput = $this.find('input.socialuxe-TwitterMFS-selectedID');
      
      // attach events to links for toggling between boxes
      $this.find('a.socialuxe-TwitterMFS-friendsLink')
           .bind('click.twittermfs', handleFriendsLinkClick);

      $this.find('a.socialuxe-TwitterMFS-selectedLink')
           .bind('click.twittermfs', handleSelectedLinkClick);
           
      // inject skip link hrefs
      $this.find('a.socialuxe-TwitterMFS-skipLink').attr('href', options.bypass_url);
      
      // attach event for submission
      $form.attr('action', options.action_url);
      $form.bind('submit.twittermfs', handleFormSubmission);
    });
  } 
  
  function selectUser($box) {
    var id = getUserIDFromBox($box);
    if (id) {
      // add as selected
      $box.addClass('selected');
    
      // clone user in selected tab
      $boxClone = $box.clone(true);
      $selectedBox.append($boxClone);
    
      // add user to selected IDs array
      if (id) {
        ids_selected.push(id);
      }
      updateSelectedInput();
    
      // update count
      $this.find('span.socialuxe-TwitterMFS-selectedCount')
           .html(ids_selected.length.toString());
           
      
    }
  }
  
  function deselectUser($box) {
    var id = getUserIDFromBox($box);
    if (id) {
      // remove selected class
      $box.removeClass('selected');
    
      // remove from selected tab
      $selectedBox.find('div.socialuxe-TwitterMFS-userid-' + id.toString()).remove();
    
      // remove from selected IDs array
      array_remove(id, ids_selected);
      
      // update count
      $this.find('span.socialuxe-TwitterMFS-selectedCount')
           .html(ids_selected.length.toString());
      
      // update input box
      updateSelectedInput();
      
      if (ids_selected.length == 0) {
        $selectedBox.hide();
        $friendsBox.show();
      }
    }
  }
  
  function getUserIDFromBox($box) {
    var classes = $box.attr('class');
    try {
      return parseInt(classes.match(/socialuxe-TwitterMFS-userid-([0-9]+)/)[1]);
    }
    catch (e) {
      return null;
    }
  }  
  
  function updateSelectedInput() {
    var idString = ids_selected.join(',');
    $selectedInput.attr('value', idString);
  }
  
  
  /**
   *  Event Handlers
   *  These functions are event handlers for MultiFriendSelector functions.
  **/
  function handleFriendsLinkClick(e) {
    if ($friendsBox.is(':hidden') && $loadingBox.is(':hidden')) {
      $selectedBox.hide();
      $friendsBox.show();
    }
    return false;
  }
  
  function handleFormSubmission(e) {
    // post this asynchronously?
    if (options.async_post) {
      e.preventDefault();
    }
    $.fn.multifriendselector.postForm($form);
  }
  
  function handleSelectedLinkClick(e) {
   if ($selectedBox.is(':hidden') && $loadingBox.is(':hidden')) {
     $friendsBox.hide();
     $selectedBox.show();
   } 
   return false;
  }
  
  function handleUserClick(e) {
    var $currentTarget = $(e.currentTarget);
    if ($currentTarget.hasClass('selected')) {
      deselectUser($currentTarget);
    } else {
      selectUser($currentTarget);
    }
    return false;
  }
  
  function handleUserMouseEnter(e) {
    var $currentTarget = $(e.currentTarget);
    $currentTarget.addClass('hover');
  }
  
  function handleUserMouseLeave(e) {
    var $currentTarget = $(e.currentTarget);
    $currentTarget.removeClass('hover');
  }
  


  /**
   *  Display Code
   *  These functions are solely for rendering MultiFriendSelector boxes. Do 
   *  not add any further logic to these functions.
  **/
  function composeUserBox(user) {
    if (typeof user.screen_name != 'undefined' && 
        typeof user.id != 'undefined') {
      
      // exclude ID if need be
      if (userIsExcluded(user.id)) { return ''; }
      
      var userMarkup = '<div class="socialuxe-TwitterMFS-user'
                     + ' socialuxe-TwitterMFS-userid-' + user.id.toString();
      if (userIsSelected(user.id)) {
        userMarkup += ' selected';
      }
      userMarkup += '">';
      if (typeof user.profile_image_url != 'undefined') {
        userMarkup += '<img src="' + user.profile_image_url 
                    + '" class="socialuxe-TwitterMFS-userImage" '
                    + 'alt="Image of ' + user.screen_name + '" />'
      }
      userMarkup += '<p class="socialuxe-TwitterMFS-userText">'
                    + '<span class="socialuxe-TwitterMFS-userName">'
                    + user.screen_name
                    + '</span>'
                    + '</p>'
                    + '</div>';
      return $(userMarkup);
    } 
    return '';
  }
  
  function composeLayout() {
    var mkup = '<form class="socialuxe-TwitterMFS"; '
    if (options.mfs_id) {
      mkup += ' id="' + options.mfs_id + '" ';
    }
    
    mkup += 'method="post" action="' + options.post_action + '">'
         + '<input type="hidden" class="socialuxe-TwitterMFS-selectedID" name="selected" value="" />'
         + '<div class="socialuxe-TwitterMFS-head">'
         + '<div class="socialuxe-TwitterMFS-introCopy">'
         + '<h4>' + options.actiontext + '</h4>'
         + '<p>' + options.actiongraf + '</p>'
         + '</div>'
         + '<div class="socialuxe-TwitterMFS-skipButton">'
         + '<a href="' + options.bypass_url + '" class="socialuxe-TwitterMFS-skipLink">' + options.bypass + '</a>'
         + '</div>'
         + '</div>'
         /*
         + '<div class="socialuxe-TwitterMFS-search">'
         + '<label for="socialuxe-TwitterMFS-searchBox">Search friends</label>'
         + '<input type="text" class="socialuxe-TwitterMFS-searchBox" name="socialuxe-TwitterMFS-searchBox" />'
         + '</div>'
         */
         + '<div class="socialuxe-TwitterMFS-friendList">'
         + '<div class="socialuxe-TwitterMFS-friendFilterset">'
         + '<ul>'
         + '<li><a href="#" class="socialuxe-TwitterMFS-friendsLink"><span class="socialuxe-TwitterMFS-friendTypeCaption">Followers</span>'
         + '(<span class="socialuxe-TwitterMFS-populationCount"></span>)</a></li>'
         + '<li><a href="#" class="socialuxe-TwitterMFS-selectedLink">Selected (<span class="socialuxe-TwitterMFS-selectedCount"></span>)</a></li>'
         + '</ul>'
         + '</div>'
         + '<div class="socialuxe-TwitterMFS-loading">&nbsp;</div>'
         + '<div class="socialuxe-TwitterMFS-friends" style="display: none;"></div>'
         + '<div class="socialuxe-TwitterMFS-friendsSelected" style="display: none;"></div>'
         + '</div>'
         + '<div class="socialuxe-TwitterMFS-actionItems">'
         + '<input type="submit" class="socialuxe-TwitterMFS-inviteButton" value="Invite" />'
         + '<a href="' + options.bypass_url + '" class="socialuxe-TwitterMFS-skipLink">' + options.bypass + '</a>'
         + '</div>'
         + '</form>';
    
    return mkup;
  }
  
})(jQuery);