function LoggedInName()
{
    const _ud = localStorage.getItem('user_data');
    const ud = _ud ? JSON.parse(_ud) : {firstName:'', lastName:''};

    function doLogout(event:React.SyntheticEvent) : void
    {
      event.preventDefault();

      localStorage.removeItem('user_data');
      localStorage.removeItem('token_data');
      window.location.href = '/';
    };

    return(
      <div id="loggedInDiv">
        <span id="userName">Logged In As {ud.firstName} {ud.lastName}</span><br />
        <button type="button" id="logoutButton" className="buttons"
           onClick={doLogout}> Log Out </button>
      </div>
    );
};

export default LoggedInName;
