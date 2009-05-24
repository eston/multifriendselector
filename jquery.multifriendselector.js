/**
 *  MultiFriendSelector
 *  A jQuery-based multi-friend selector control.
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
 *  @requires jquery-1.3.2
 *  @provides multifriendselector
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
        debug('MultiFriendSelector: No ID has been specified.');
      }
      return false;
    }
    
    // inject the layout here
    if (options.development_mode) {
      injectLayout($this);
    } else {
      $this.append($(composeLayout()));
      
      $form = $this.find('form.socialuxe-MFS');
      $friendsBox = $this.find('div.socialuxe-MFS-friends');
      $selectedBox = $this.find('div.socialuxe-MFS-friendsSelected');
      $loadingBox = $this.find('div.socialuxe-MFS-loading');
      $selectedInput = $this.find('input.socialuxe-MFS-selectedID');
      
      // attach events to links for toggling between boxes
      $this.find('a.socialuxe-MFS-friendsLink')
           .bind('click.MFS', handleFriendsLinkClick);

      $this.find('a.socialuxe-MFS-selectedLink')
           .bind('click.MFS', handleSelectedLinkClick);
           
      // inject skip link hrefs
      $this.find('a.socialuxe-MFS-skipLink').attr('href', options.bypass_url);
      
      // attach event for submission
      $form.attr('action', options.action_url);
      $form.bind('submit.MFS', handleFormSubmission);
    }
    $friendsBox = $this.find('div.socialuxe-MFS-friends');
    $selectedBox = $this.find('div.socialuxe-MFS-friendsSelected');
    $loadingBox = $this.find('div.socialuxe-MFS-loading');
    
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
    async_post_success_callback: function() { },
    async_post_error_callback: function() { },
    bypass: '',
    bypass_url: '/',
    development_mode: false,
    exclude_ids: [],
    friend_type: 'friends',
    id: null,
    limit: 100,
    mfs_id: ''
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
      endpoint = options.action_url;
    }
    
    var idString = $selectedInput.val();
    $.post(endpoint, {selected: idString},
           function(data, textStatus) {
             if (textStatus == 'success') {
               options.async_post_success_callback();
             } else {
               options.async_post_error_callback();
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
        $(element).bind('click.MFS', handleUserClick);
        
        // attach hover interactions to box
        $(element).bind('mouseenter.MFS', handleUserMouseEnter);
        $(element).bind('mouseleave.MFS', handleUserMouseLeave);
        
      }
      while (--i);
      $friendsBox.show();
      $loadingBox.hide();
      $this.find('span.socialuxe-MFS-populationCount')
           .html(people.length.toString());
    }
  }
  
  function injectLayout($into) {
    $into.load('../dev/multifriendselector.html', {}, function() {
      $form = $this.find('form.socialuxe-MFS');
      $friendsBox = $this.find('div.socialuxe-MFS-friends');
      $selectedBox = $this.find('div.socialuxe-MFS-friendsSelected');
      $loadingBox = $this.find('div.socialuxe-MFS-loading');
      $selectedInput = $this.find('input.socialuxe-MFS-selectedID');
      
      // attach events to links for toggling between boxes
      $this.find('a.socialuxe-MFS-friendsLink')
           .bind('click.MFS', handleFriendsLinkClick);

      $this.find('a.socialuxe-MFS-selectedLink')
           .bind('click.MFS', handleSelectedLinkClick);
           
      // inject skip link hrefs
      $this.find('a.socialuxe-MFS-skipLink').attr('href', options.bypass_url);
      
      // attach event for submission
      $form.attr('action', options.action_url);
      $form.bind('submit.MFS', handleFormSubmission);
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
      $this.find('span.socialuxe-MFS-selectedCount')
           .html(ids_selected.length.toString());
           
      
    }
  }
  
  function deselectUser($box) {
    var id = getUserIDFromBox($box);
    if (id) {
      // remove selected class
      $box.removeClass('selected');
    
      // remove from selected tab
      $selectedBox.find('div.socialuxe-MFS-userid-' + id.toString()).remove();
    
      // remove from selected IDs array
      array_remove(id, ids_selected);
      
      // update count
      $this.find('span.socialuxe-MFS-selectedCount')
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
      return parseInt(classes.match(/socialuxe-MFS-userid-([0-9]+)/)[1]);
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
      
      var userMarkup = '<div class="socialuxe-MFS-user'
                     + ' socialuxe-MFS-userid-' + user.id.toString();
      if (userIsSelected(user.id)) {
        userMarkup += ' selected';
      }
      userMarkup += '">';
      if (typeof user.profile_image_url != 'undefined') {
        userMarkup += '<img src="' + user.profile_image_url 
                    + '" class="socialuxe-MFS-userImage" '
                    + 'alt="Image of ' + user.screen_name + '" />'
      }
      userMarkup += '<p class="socialuxe-MFS-userText">'
                    + '<span class="socialuxe-MFS-userName">'
                    + user.screen_name
                    + '</span>'
                    + '</p>'
                    + '</div>';
      return $(userMarkup);
    } 
    return '';
  }
  
  function composeLayout() {
    var mkup = '<form class="socialuxe-MFS"; ';
    
    if (options.mfs_id) {
      mkup += ' id="' + options.mfs_id + '" ';
    }
    
    mkup += 'method="post" action="' + options.action_url + '">'
         + '<input type="hidden" class="socialuxe-MFS-selectedID" name="selected" value="" />'
         + '<div class="socialuxe-MFS-head">'
         + '<div class="socialuxe-MFS-introCopy">'
         + '<h4>' + options.actiontext + '</h4>'
         + '<p>' + options.actiongraf + '</p>'
         + '</div>';
         
    if (options.bypass) {     
      mkup += '<div class="socialuxe-MFS-skipButton">'
           + '<a href="' + options.bypass_url + '" class="socialuxe-MFS-skipLink">' + options.bypass + '</a>'
           + '</div>'
    }
    
     mkup += '</div>'
         /*
         + '<div class="socialuxe-MFS-search">'
         + '<label for="socialuxe-MFS-searchBox">Search friends</label>'
         + '<input type="text" class="socialuxe-MFS-searchBox" name="socialuxe-MFS-searchBox" />'
         + '</div>'
         */
         + '<div class="socialuxe-MFS-friendList">'
         + '<div class="socialuxe-MFS-friendFilterset">'
         + '<ul>'
         + '<li><a href="#" class="socialuxe-MFS-friendsLink"><span class="socialuxe-MFS-friendTypeCaption">Followers</span>'
         + '(<span class="socialuxe-MFS-populationCount"></span>)</a></li>'
         + '<li><a href="#" class="socialuxe-MFS-selectedLink">Selected (<span class="socialuxe-MFS-selectedCount"></span>)</a></li>'
         + '</ul>'
         + '</div>'
         + '<div class="socialuxe-MFS-loading">&nbsp;</div>'
         + '<div class="socialuxe-MFS-friends" style="display: none;"></div>'
         + '<div class="socialuxe-MFS-friendsSelected" style="display: none;"></div>'
         + '</div>'
         + '<div class="socialuxe-MFS-actionItems">'
         + '<input type="submit" class="socialuxe-MFS-inviteButton" value="Invite" />';
         
    if (options.bypass) {
      mkup += '<a href="' + options.bypass_url + '" class="socialuxe-MFS-skipLink">' + options.bypass + '</a>'
    }
    
    mkup += '</div>'
         + '</form>';
    
    return mkup;
  }
  
})(jQuery);